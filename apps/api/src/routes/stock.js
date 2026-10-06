import { Router } from 'express';
import mongoose from 'mongoose';
import { ALERT_TYPES, formatQty, LOCATION_TYPES, reasonSchema, ROLES, round, STOCK_GRADES, stockCountSchema } from '@feather/shared';
import { requireRole } from '@/middleware/auth.js';
import { validate } from '@/middleware/validate.js';
import { Location, Material, StockCount, Trip } from '@/models/index.js';
import { raiseAlert } from '@/services/alerts.js';
import { audit } from '@/services/audit.js';
import { getSettings } from '@/services/settings.js';
import { addToOldestLot, bookQty, bookStock, issueFifo, lotLedger, stockLots, tripLots } from '@/services/stock.js';
import { badRequest, forbidden, notFound } from '@/utils/http.js';

const router = Router();
const { OWNER, DISPATCH_OPERATOR, GATE_INSPECTOR } = ROLES;

/** Optional ?name=<id> filter; rejects anything that is not an id. */
function idParam(req, name) {
  const v = req.query[name];
  if (!v || v === 'all') return undefined;
  if (!mongoose.isValidObjectId(v)) throw badRequest(`Bad ${name}.`);
  return new mongoose.Types.ObjectId(String(v));
}

/** Book stock (quantities only — no money). */
router.get('/', requireRole(OWNER, DISPATCH_OPERATOR), async (_req, res) => {
  res.json({ items: await bookStock() });
});

/**
 * Stock per shipment (lot): what is left from each shipment in each warehouse, its age and shelf
 * life, and the order it goes out in (first in, first out). ?location= &material= to filter.
 */
router.get('/lots', requireRole(OWNER, DISPATCH_OPERATOR), async (req, res) => {
  res.json(await stockLots({ location: idParam(req, 'location'), material: idParam(req, 'material'), owner: req.user.role === OWNER }));
});

/** Every in / out of one shipment lot at one warehouse. lot = shipment id, or "none". */
router.get('/lots/ledger', requireRole(OWNER), async (req, res) => {
  const location = idParam(req, 'location');
  const material = idParam(req, 'material');
  if (!location || !material) throw badRequest('Choose the warehouse and product.');
  const lot = req.query.lot === 'none' ? 'none' : idParam(req, 'lot');
  if (!lot) throw badRequest('Choose the shipment.');
  res.json({ items: await lotLedger({ location, material, lot }) });
});

/** Which shipment to load next from a warehouse (good stock, oldest manufactured first). For the dispatch form. */
router.get('/fifo-next', requireRole(OWNER, DISPATCH_OPERATOR), async (req, res) => {
  const location = idParam(req, 'location');
  const material = idParam(req, 'material');
  if (!location || !material) return res.json({ items: [] });
  const { items } = await stockLots({ location, material });
  res.json({
    items: items
      .filter((r) => r.fifoRank)
      .sort((a, b) => a.fifoRank - b.fifoRank)
      .slice(0, 3)
      .map((r) => ({ lot: r.lot, stockId: r.stockId, shipment: r.shipment && { referenceType: r.shipment.referenceType, referenceNo: r.shipment.referenceNo }, arrivedAt: r.arrivedAt, manufacturedAt: r.manufacturedAt, qty: r.qty.prime, unit: r.unit, shelf: r.shelf })),
  });
});

/** Shipments a trip's stock came from / went to. */
router.get('/trip/:id', requireRole(OWNER, DISPATCH_OPERATOR), async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id) || !(await Trip.exists({ _id: req.params.id }))) throw notFound('Trip');
  res.json({ items: await tripLots(req.params.id) });
});

/** Book vs latest physical count for each yard / material / grade. */
router.get('/reconciliation', requireRole(OWNER), async (req, res) => {
  const location = idParam(req, 'location');
  const match = location ? { location } : {};
  const [book, counts, settings] = await Promise.all([
    bookStock(match),
    StockCount.aggregate([
      { $match: match },
      { $sort: { createdAt: -1 } },
      { $group: { _id: { location: '$location', material: '$material', grade: '$grade' }, last: { $first: '$$ROOT' } } },
    ]),
    getSettings(),
  ]);
  const key = (l, m, g) => `${l}:${m}:${g}`;
  const countMap = new Map(counts.map((c) => [key(c._id.location, c._id.material, c._id.grade), c.last]));
  const items = book.map((b) => {
    const last = countMap.get(key(b.location._id, b.material._id, b.grade));
    return { ...b, lastCount: last ? { _id: last._id, physicalQty: last.physicalQty, bookQtyAtCount: last.bookQty, diffQty: last.diffQty, diffPct: last.diffPct, at: last.createdAt, adjustedAt: last.adjustedAt } : null };
  });
  res.json({ items, mismatchPct: settings.stockMismatchPct });
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
  if (!location || location.type !== LOCATION_TYPES.STOCKYARD) throw badRequest('Choose a warehouse.');
  if (!material) throw badRequest('Choose the material.');
  const u = req.user;
  if (u.role === GATE_INSPECTOR && u.locations?.length && !u.locations.some((l) => String(l) === String(location._id))) {
    throw forbidden('You are not assigned to this warehouse.');
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
        `System stock: ${formatQty(book, material.unit)}. Difference: ${formatQty(diffQty, material.unit)}${diffPct !== null ? ` (${diffPct}%)` : ''}.`,
      ],
    });
  }
  // Reply without book figures so the counter cannot learn them.
  res.status(201).json({ ok: true, id: count._id });
});

/** Counts, newest first. supersededBy = a newer count of the same stock (only the newest can be accepted). */
router.get('/counts', requireRole(OWNER), async (req, res) => {
  const location = idParam(req, 'location');
  const items = await StockCount.find(location ? { location } : {})
    .sort({ createdAt: -1 })
    .limit(200)
    .populate('location', 'name')
    .populate('material', 'name unit')
    .populate('countedBy', 'name')
    .populate('adjustedBy', 'name')
    .lean();
  const newest = new Map();
  for (const c of items) {
    const k = `${c.location?._id}:${c.material?._id}:${c.grade}`;
    if (newest.has(k)) c.supersededBy = newest.get(k);
    else newest.set(k, c._id);
  }
  res.json({ items });
});

/**
 * Owner accepts a physical count. The difference found AT THE TIME OF COUNTING is posted, so trucks
 * received or sent between the count and the acceptance are kept. A shortage comes out of the oldest
 * shipment first; extra stock is added to the oldest shipment still in stock.
 */
router.post('/counts/:id/adjust', requireRole(OWNER), validate(reasonSchema), async (req, res) => {
  const count = await StockCount.findById(req.params.id);
  if (!count) throw notFound('Stock count');
  if (count.adjustedAt) throw badRequest('Already accepted.');
  const newer = await StockCount.exists({ location: count.location, material: count.material, grade: count.grade, createdAt: { $gt: count.createdAt } });
  if (newer) throw badRequest('There is a newer count of this stock. Accept that one instead.');
  const material = await Material.findById(count.material);
  const diff = round(count.diffQty ?? count.physicalQty - (count.bookQty ?? 0));
  const before = await bookQty(count.location, count.material, count.grade);
  const stock = { location: count.location, material: count.material, unit: material.unit, grade: count.grade ?? STOCK_GRADES.PRIME, reason: 'adjustment', stockCount: count._id, note: req.valid.reason, by: req.user._id };
  if (diff < 0) await issueFifo({ ...stock, qty: -diff });
  else if (diff > 0) await addToOldestLot({ ...stock, qty: diff });
  count.adjustedAt = new Date();
  count.adjustedBy = req.user._id;
  count.adjustedQty = diff;
  await count.save();
  await audit(req, { action: 'stock.adjust', entity: 'StockCount', entityId: count._id, reason: req.valid.reason, before: { book: before }, after: { book: round(before + diff), adjustedBy: diff } });
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