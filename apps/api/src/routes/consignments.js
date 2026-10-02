import { Router } from 'express';
import {
  CONSIGNMENT_STATUS,
  consignmentSchema,
  demurrage,
  LOCATION_TYPES,
  reasonSchema,
  REFERENCE_TYPE_BY_MODE,
  ROLES,
  round,
  TRIP_STATUS,
} from '@feather/shared';
import { requireRole } from '@/middleware/auth.js';
import { validate } from '@/middleware/validate.js';
import { Consignment, Location, Material, Trip } from '@/models/index.js';
import { audit } from '@/services/audit.js';
import { getSettings } from '@/services/settings.js';
import { badRequest, forbidden, notFound } from '@/utils/http.js';
import { presentConsignment, presentTrips } from '@/utils/present.js';

const router = Router();
const { OWNER, DISPATCH_OPERATOR, SIDING_SUPERVISOR } = ROLES;

export function withClock(c, settings) {
  return {
    ...c,
    clock: demurrage({
      placedAt: c.placedAt,
      freeTimeHours: c.freeTimeHours,
      wagonCount: c.wagonCount,
      ratePerWagonHour: c.demurrageRatePerWagonHour ?? 0,
      declaredQty: c.declaredQty,
      liftedQty: c.liftedQty,
      releasedAt: c.releasedAt,
      warnHours: settings.demurrageWarnHours,
    }),
    balanceAtSiding: round(Math.max(0, c.declaredQty - c.liftedQty)),
  };
}

/** Field staff only see consignments at their own sidings. */
function scope(user) {
  if (user.role === SIDING_SUPERVISOR && user.locations?.length) return { location: { $in: user.locations } };
  if (user.role !== OWNER && user.role !== DISPATCH_OPERATOR && user.role !== SIDING_SUPERVISOR) return { _id: null };
  return {};
}

router.get('/', async (req, res) => {
  const filter = scope(req.user);
  if (req.query.status) filter.status = { $in: String(req.query.status).split(',') };
  const [items, settings] = await Promise.all([
    Consignment.find(filter)
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(req.query.limit) || 100, 500))
      .populate('material', 'name unit kind')
      .populate('location', 'name type')
      .lean(),
    getSettings(),
  ]);
  res.json({ items: items.map((c) => withClock(presentConsignment(c, req.user.role), settings)) });
});

router.get('/:id', async (req, res) => {
  const c = await Consignment.findOne({ _id: req.params.id, ...scope(req.user) })
    .populate('material')
    .populate('location', 'name type')
    .lean();
  if (!c) throw notFound('Shipment');
  const trips = await Trip.find({ consignment: c._id })
    .sort({ 'loading.at': -1 })
    .populate('transporter', 'name')
    .populate('destination', 'name type')
    .lean();
  const settings = await getSettings();
  const presented = withClock(presentConsignment(c, req.user.role), settings);
  if (req.user.role === OWNER || req.user.role === DISPATCH_OPERATOR) {
    const live = trips.filter((t) => t.status !== TRIP_STATUS.CANCELLED);
    presented.reconciliation = {
      declaredQty: c.declaredQty,
      liftedQty: round(c.liftedQty),
      balanceAtSiding: round(Math.max(0, c.declaredQty - c.liftedQty)),
      onRoadQty: round(live.filter((t) => t.status === TRIP_STATUS.IN_TRANSIT).reduce((s, t) => s + t.loading.qty, 0)),
      receivedLoadedQty: round(c.receivedLoadedQty),
      receivedQty: round(c.receivedQty),
      transitLossQty: round(c.receivedLoadedQty - c.receivedQty),
      lockedTrips: live.filter((t) => t.freight?.status === 'locked').length,
      // After release, anything the RR / BL declared but trucks did not lift is unexplained.
      unexplainedQty: c.releasedAt ? round(c.declaredQty - c.liftedQty) : null,
    };
  }
  res.json({ item: presented, trips: await presentTrips(trips, req.user) });
});

router.post('/', requireRole(OWNER, DISPATCH_OPERATOR), validate(consignmentSchema), async (req, res) => {
  const data = { ...req.valid };
  const [material, location] = await Promise.all([Material.findById(data.material), Location.findById(data.location)]);
  if (!material) throw badRequest('Choose the material.');
  if (!location || ![LOCATION_TYPES.SIDING, LOCATION_TYPES.PORT].includes(location.type)) {
    throw badRequest('Choose a railway station or port.');
  }
  if (req.user.role !== OWNER) delete data.purchaseRatePerUnit;
  const c = await Consignment.create({
    ...data,
    referenceType: REFERENCE_TYPE_BY_MODE[data.mode],
    unit: material.unit,
    createdBy: req.user._id,
  });
  await audit(req, { action: 'consignment.create', entity: 'Consignment', entityId: c._id, after: data });
  res.status(201).json({ item: presentConsignment(c, req.user.role) });
});

router.patch('/:id', requireRole(OWNER), validate(consignmentSchema), async (req, res) => {
  const c = await Consignment.findById(req.params.id);
  if (!c) throw notFound('Shipment');
  if (String(c.material) !== req.valid.material && c.tripCount > 0) throw badRequest('Material cannot change after loading has started.');
  const before = c.toObject();
  c.set({ ...req.valid, referenceType: REFERENCE_TYPE_BY_MODE[req.valid.mode] });
  await c.save();
  await audit(req, { action: 'consignment.update', entity: 'Consignment', entityId: c._id, before, after: req.valid });
  res.json({ item: presentConsignment(c, req.user.role) });
});

async function loadForAction(req) {
  const c = await Consignment.findById(req.params.id);
  if (!c) throw notFound('Shipment');
  const u = req.user;
  if (u.role === SIDING_SUPERVISOR && u.locations?.length && !u.locations.some((l) => String(l) === String(c.location))) {
    throw forbidden('You are not assigned to this unloading point.');
  }
  return c;
}

/** Rake placed at siding / ship berthed — free-time clock starts (server time). */
router.post('/:id/place', requireRole(OWNER, DISPATCH_OPERATOR, SIDING_SUPERVISOR), async (req, res) => {
  const c = await loadForAction(req);
  if (c.status !== CONSIGNMENT_STATUS.EXPECTED) throw badRequest('Already placed.');
  c.status = CONSIGNMENT_STATUS.PLACED;
  c.placedAt = new Date();
  await c.save();
  await audit(req, { action: 'consignment.place', entity: 'Consignment', entityId: c._id, after: { placedAt: c.placedAt } });
  res.json({ item: presentConsignment(c, req.user.role) });
});

/** Rake empty and handed back to Railways / ship sailed. Final demurrage is fixed. */
router.post('/:id/release', requireRole(OWNER, DISPATCH_OPERATOR, SIDING_SUPERVISOR), async (req, res) => {
  const c = await loadForAction(req);
  if (c.status !== CONSIGNMENT_STATUS.PLACED) throw badRequest('Only an unloading shipment can be released.');
  c.releasedAt = new Date();
  c.status = CONSIGNMENT_STATUS.RELEASED;
  const clock = demurrage({
    placedAt: c.placedAt,
    freeTimeHours: c.freeTimeHours,
    wagonCount: c.wagonCount,
    ratePerWagonHour: c.demurrageRatePerWagonHour ?? 0,
    declaredQty: c.declaredQty,
    liftedQty: c.liftedQty,
    releasedAt: c.releasedAt,
  });
  c.set('demurrage.finalPenalty', clock.projectedPenalty);
  c.set('demurrage.finalOverHours', clock.projectedOverHours);
  await c.save();
  await audit(req, { action: 'consignment.release', entity: 'Consignment', entityId: c._id, after: { releasedAt: c.releasedAt, penalty: clock.projectedPenalty } });
  res.json({ item: presentConsignment(c, req.user.role) });
});

router.post('/:id/close', requireRole(OWNER), validate(reasonSchema), async (req, res) => {
  const c = await Consignment.findById(req.params.id);
  if (!c) throw notFound('Shipment');
  const onRoad = await Trip.countDocuments({ consignment: c._id, status: TRIP_STATUS.IN_TRANSIT });
  if (onRoad) throw badRequest(`${onRoad} trucks are still on the road. Receive them first.`);
  c.status = CONSIGNMENT_STATUS.CLOSED;
  c.closedAt = new Date();
  await c.save();
  await audit(req, { action: 'consignment.close', entity: 'Consignment', entityId: c._id, reason: req.valid.reason });
  res.json({ item: presentConsignment(c, req.user.role) });
});

export default router;
