import { Router } from 'express';
import { ALERT_TYPES, formatQty, LOCATION_TYPES, reasonSchema, ROLES, round, stockCountSchema } from '@feather/shared';
import { requireRole } from '@/middleware/auth.js';
import { validate } from '@/middleware/validate.js';
import { Location, Material, StockCount } from '@/models/index.js';
import { raiseAlert } from '@/services/alerts.js';
import { audit } from '@/services/audit.js';
import { getSettings } from '@/services/settings.js';
import { bookQty, bookStock, move } from '@/services/stock.js';
import { badRequest, forbidden, notFound } from '@/utils/http.js';

const router = Router();
const { OWNER, DISPATCH_OPERATOR, GATE_INSPECTOR } = ROLES;

/** Book stock (quantities only — no money). */
router.get('/', requireRole(OWNER, DISPATCH_OPERATOR), async (_req, res) => {
  res.json({ items: await bookStock() });
});

/** Book vs latest physical count for each yard / material / grade. */
router.get('/reconciliation', requireRole(OWNER), async (_req, res) => {
  const [book, counts] = await Promise.all([
    bookStock(),
    StockCount.aggregate([
      { $sort: { createdAt: -1 } },
      { $group: { _id: { location: '$location', material: '$material', grade: '$grade' }, last: { $first: '$$ROOT' } } },
    ]),
  ]);
  const key = (l, m, g) => `${l}:${m}:${g}`;
  const countMap = new Map(counts.map((c) => [key(c._id.location, c._id.material, c._id.grade), c.last]));
  const items = book.map((b) => {
    const last = countMap.get(key(b.location._id, b.material._id, b.grade));
    return { ...b, lastCount: last ? { _id: last._id, physicalQty: last.physicalQty, bookQtyAtCount: last.bookQty, diffQty: last.diffQty, diffPct: last.diffPct, at: last.createdAt, adjustedAt: last.adjustedAt } : null };
  });
  res.json({ items });
});

/**
 * Physical stock count from the yard. Blind: the counter never sees book stock.
 * The difference is worked out on the server.
 */
router.post('/counts', requireRole(OWNER, GATE_INSPECTOR), validate(stockCountSchema), async (req, res) => {
  const d = req.valid;
  const dup = await StockCount.findOne({ clientId: d.clientId });
  if (dup) return res.json({ ok: true, id: dup._id });
  const [location, material] = await Promise.all([Location.findById(d.location), Material.findById(d.material)]);
  if (!location || location.type !== LOCATION_TYPES.STOCKYARD) throw badRequest('Choose a stockyard.');
  if (!material) throw badRequest('Choose the material.');
  const u = req.user;
  if (u.role === GATE_INSPECTOR && u.locations?.length && !u.locations.some((l) => String(l) === String(location._id))) {
    throw forbidden('You are not assigned to this yard.');
  }
  const book = await bookQty(location._id, material._id, d.grade);
  const diffQty = round(d.physicalQty - book);
  const diffPct = book ? round((diffQty / book) * 100, 2) : null;
  const count = await StockCount.create({
    location: location._id,
    material: material._id,
    grade: d.grade,
    physicalQty: d.physicalQty,
    bookQty: book,
    diffQty,
    diffPct,
    method: d.method,
    countedBy: u._id,
    clientId: d.clientId,
  });
  const settings = await getSettings();
  if (diffPct === null ? diffQty !== 0 : Math.abs(diffPct) > settings.stockMismatchPct) {
    await raiseAlert({
      type: ALERT_TYPES.STOCK_MISMATCH,
      title: `Stock mismatch at ${location.name} — ${material.name}`,
      lines: [
        `Counted by ${u.name}: ${formatQty(d.physicalQty, material.unit)}.`,
        `Book stock: ${formatQty(book, material.unit)}. Difference: ${formatQty(diffQty, material.unit)}${diffPct !== null ? ` (${diffPct}%)` : ''}.`,
      ],
    });
  }
  // Reply without book figures so the counter cannot learn them.
  res.status(201).json({ ok: true, id: count._id });
});

router.get('/counts', requireRole(OWNER), async (_req, res) => {
  const items = await StockCount.find()
    .sort({ createdAt: -1 })
    .limit(200)
    .populate('location', 'name')
    .populate('material', 'name unit')
    .populate('countedBy', 'name')
    .lean();
  res.json({ items });
});

/** Owner accepts a physical count: book stock is moved to match it. */
router.post('/counts/:id/adjust', requireRole(OWNER), validate(reasonSchema), async (req, res) => {
  const count = await StockCount.findById(req.params.id);
  if (!count) throw notFound('Stock count');
  if (count.adjustedAt) throw badRequest('Already adjusted.');
  const material = await Material.findById(count.material);
  const book = await bookQty(count.location, count.material, count.grade);
  const diff = round(count.physicalQty - book);
  await move({ location: count.location, material: count.material, unit: material.unit, grade: count.grade, qty: diff, reason: 'adjustment', stockCount: count._id, note: req.valid.reason, by: req.user._id });
  count.adjustedAt = new Date();
  count.adjustedBy = req.user._id;
  await count.save();
  await audit(req, { action: 'stock.adjust', entity: 'StockCount', entityId: count._id, reason: req.valid.reason, before: { book }, after: { book: count.physicalQty } });
  res.json({ ok: true, adjustedBy: diff });
});

/** Yard list for the counting screen (names only). */
router.get('/count-options', requireRole(OWNER, GATE_INSPECTOR), async (req, res) => {
  const filter = { type: LOCATION_TYPES.STOCKYARD, active: true };
  if (req.user.role === GATE_INSPECTOR && req.user.locations?.length) filter._id = { $in: req.user.locations };
  const [locations, materials] = await Promise.all([
    Location.find(filter, 'name').sort({ name: 1 }).lean(),
    Material.find({ active: true }, 'name unit kind').sort({ name: 1 }).lean(),
  ]);
  res.json({ locations, materials });
});

export default router;
