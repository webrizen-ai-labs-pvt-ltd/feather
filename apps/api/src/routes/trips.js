import { Router } from 'express';
import {
  advanceSchema,
  ALERT_TYPES,
  assignOrderSchema,
  breakdownSchema,
  FREIGHT_STATUS,
  formatVehicleNo,
  freightSettlement,
  loadingSchema,
  reasonSchema,
  receiptSchema,
  ROLES,
  roundMoney,
  TRIP_FLAGS,
  TRIP_SOURCE,
  TRIP_STATUS,
  tripCorrectionSchema,
} from '@feather/shared';
import { requireRole } from '@/middleware/auth.js';
import { photoUpload } from '@/middleware/upload.js';
import { validate } from '@/middleware/validate.js';
import { Order, Trip } from '@/models/index.js';
import { raiseAlert } from '@/services/alerts.js';
import { audit } from '@/services/audit.js';
import { nextNumber } from '@/services/counters.js';
import { activeOverride, consumeOverride, customerCredit } from '@/services/credit.js';
import { getSettings } from '@/services/settings.js';
import { cancelTrip, correctTrip, createLoading, receiveTrip } from '@/services/trips.js';
import { badRequest, escapeRegex, HttpError, notFound, pageParams } from '@/utils/http.js';
import { presentTrip, presentTrips } from '@/utils/present.js';

const router = Router();
const { OWNER, DISPATCH_OPERATOR, SIDING_SUPERVISOR, GATE_INSPECTOR } = ROLES;
const office = requireRole(OWNER, DISPATCH_OPERATOR);
const ownerOnly = requireRole(OWNER);

const POPULATE = [
  { path: 'transporter', select: 'name' },
  { path: 'material', select: 'name unit kind bagWeightKg' },
  { path: 'sourceLocation', select: 'name type' },
  { path: 'destination', select: 'name type' },
  { path: 'customer', select: 'name' },
  { path: 'consignment', select: 'referenceType referenceNo mode' },
  { path: 'order', select: 'orderNo ratePerUnit' },
];

/** What each role is allowed to list. */
function scope(user) {
  const mine = user.locations?.length ? user.locations : null;
  if (user.role === SIDING_SUPERVISOR) return mine ? { sourceLocation: { $in: mine } } : { 'loading.by': user._id };
  if (user.role === GATE_INSPECTOR) return mine ? { destination: { $in: mine } } : { 'receipt.by': user._id };
  return {};
}

async function findScoped(req) {
  const trip = await Trip.findOne({ _id: req.params.id, ...scope(req.user) });
  if (!trip) throw notFound('Trip');
  return trip;
}

const reply = async (res, trip, user, status = 200) => {
  await trip.populate(POPULATE);
  res.status(status).json({ item: await presentTrip(trip, user, { photos: true }) });
};

// ---------- Field entry ----------

router.post('/loading', requireRole(OWNER, DISPATCH_OPERATOR, SIDING_SUPERVISOR), photoUpload, validate(loadingSchema), async (req, res) => {
  const { trip, duplicate } = await createLoading({ input: req.valid, file: req.file, user: req.user });
  await reply(res, trip, req.user, duplicate ? 200 : 201);
});

/** Gate inspector's list of trucks coming to their yard / site. Blind: no loading weights. */
router.get('/arrivals', requireRole(OWNER, DISPATCH_OPERATOR, GATE_INSPECTOR), async (req, res) => {
  const trips = await Trip.find({ status: TRIP_STATUS.IN_TRANSIT, ...scope(req.user) })
    .sort({ 'loading.at': 1 })
    .limit(300)
    .populate(POPULATE)
    .lean();
  res.json({ items: await presentTrips(trips, req.user) });
});

router.post('/:id/receive', requireRole(OWNER, DISPATCH_OPERATOR, GATE_INSPECTOR), photoUpload, validate(receiptSchema), async (req, res) => {
  const { trip, duplicate } = await receiveTrip({ tripId: req.params.id, input: req.valid, file: req.file, user: req.user });
  await reply(res, trip, req.user, duplicate ? 200 : 201);
});

// ---------- Lists ----------

router.get('/', async (req, res) => {
  const q = req.query;
  const filter = { ...scope(req.user) };
  if (q.status) filter.status = { $in: String(q.status).split(',') };
  if (q.freight) filter['freight.status'] = { $in: String(q.freight).split(',') };
  if (q.flagged === 'true') filter['flags.0'] = { $exists: true };
  if (q.flag) filter.flags = q.flag;
  for (const key of ['consignment', 'transporter', 'customer', 'destination', 'order', 'material']) {
    if (q[key]) filter[key] = q[key];
  }
  if (q.from || q.to) {
    filter['loading.at'] = {};
    if (q.from) filter['loading.at'].$gte = new Date(q.from);
    if (q.to) filter['loading.at'].$lte = new Date(q.to);
  }
  if (q.search) {
    const s = escapeRegex(String(q.search).trim().toUpperCase().replace(/\s+/g, ''));
    filter.$or = [{ vehicleNo: { $regex: s } }, { tripNo: { $regex: s } }, { challanNo: { $regex: s } }];
  }
  const { limit, skip, page } = pageParams(q);
  const [items, total] = await Promise.all([
    Trip.find(filter).sort({ 'loading.at': -1 }).skip(skip).limit(limit).populate(POPULATE).lean(),
    Trip.countDocuments(filter),
  ]);
  res.json({ items: await presentTrips(items, req.user), total, page, limit });
});

/** Trucks on the road longer than normal, or broken down. */
router.get('/delayed', office, async (_req, res) => {
  const settings = await getSettings();
  const now = Date.now();
  const trips = await Trip.find({ status: TRIP_STATUS.IN_TRANSIT }).sort({ 'loading.at': 1 }).populate(POPULATE).lean();
  const items = trips
    .map((t) => {
      const hours = (now - new Date(t.loading.at)) / 3_600_000;
      const expected = t.expectedTransitHours ?? settings.defaultExpectedTransitHours;
      return { ...t, hoursOnRoad: Math.round(hours * 10) / 10, overdueHours: Math.round((hours - expected) * 10) / 10 };
    })
    .filter((t) => t.overdueHours > 0 || t.breakdown?.active);
  res.json({ items });
});

router.get('/:id', async (req, res) => {
  const trip = await findScoped(req);
  await reply(res, trip, req.user);
});

// ---------- Dispatch actions ----------

/** Send a truck lifted from a rake to a customer order. Credit hard-stop applies here too. */
router.post('/:id/assign', office, validate(assignOrderSchema), async (req, res) => {
  const trip = await Trip.findById(req.params.id);
  if (!trip) throw notFound('Trip');
  if (trip.status !== TRIP_STATUS.IN_TRANSIT) throw badRequest('Truck is not on the road.');
  if (trip.order) throw badRequest('This truck is already sent against an order.');
  if (trip.source !== TRIP_SOURCE.CONSIGNMENT) throw badRequest('Only trucks lifted from a rake / ship can be re-assigned.');
  const order = await Order.findById(req.valid.order);
  if (!order || order.status !== 'open') throw badRequest('This order is not open.');
  if (String(order.material) !== String(trip.material)) throw badRequest('The order is for a different material.');

  const value = roundMoney(trip.loading.qty * order.ratePerUnit);
  const check = await customerCredit(order.customer, value);
  const credit = { snapshot: check };
  if (check.blocked) {
    if (req.user.role === OWNER && req.valid.overrideReason) {
      credit.overrideReason = req.valid.overrideReason;
    } else {
      const override = await activeOverride(order.customer);
      if (!override || !(await consumeOverride(override._id, trip._id))) {
        throw new HttpError(403, 'Dispatch blocked: credit limit crossed or payment overdue. Ask the owner.', { code: 'CREDIT_BLOCKED', data: check });
      }
      credit.override = override._id;
      credit.overrideReason = override.reason;
    }
    trip.flags.addToSet(TRIP_FLAGS.CREDIT_OVERRIDE);
  }
  const before = { destination: trip.destination };
  trip.order = order._id;
  trip.customer = order.customer;
  trip.destination = order.deliverySite;
  trip.challanNo = await nextNumber('DC');
  trip.credit = credit;
  await trip.save();
  await Order.updateOne({ _id: order._id }, { $inc: { dispatchedQty: trip.loading.qty } });
  await audit(req, { action: 'trip.assign_order', entity: 'Trip', entityId: trip._id, before, after: { order: order._id, destination: order.deliverySite } });
  await reply(res, trip, req.user);
});

router.post('/:id/breakdown', office, validate(breakdownSchema), async (req, res) => {
  const trip = await Trip.findById(req.params.id);
  if (!trip || trip.status !== TRIP_STATUS.IN_TRANSIT) throw badRequest('Truck is not on the road.');
  trip.breakdown = { active: true, note: req.valid.note, at: new Date(), by: req.user._id };
  trip.flags.addToSet(TRIP_FLAGS.BREAKDOWN);
  await trip.save();
  await raiseAlert({
    type: ALERT_TYPES.BREAKDOWN,
    title: `Breakdown — ${formatVehicleNo(trip.vehicleNo)}`,
    lines: [`Trip ${trip.tripNo}.`, `Note: ${req.valid.note}`, `Reported by ${req.user.name}.`],
    trip: trip._id,
    email: false,
  });
  await reply(res, trip, req.user);
});

router.post('/:id/breakdown/clear', office, async (req, res) => {
  const trip = await Trip.findById(req.params.id);
  if (!trip) throw notFound('Trip');
  trip.set('breakdown.active', false);
  trip.set('breakdown.clearedAt', new Date());
  await trip.save();
  await reply(res, trip, req.user);
});

router.patch('/:id/advance', office, validate(advanceSchema), async (req, res) => {
  const trip = await Trip.findById(req.params.id);
  if (!trip) throw notFound('Trip');
  if (trip.freight.status === FREIGHT_STATUS.PAID) throw badRequest('Freight is already paid.');
  const before = trip.freight.advance;
  Object.assign(trip.freight, freightSettlement({ loadedQty: trip.loading.qty, rate: trip.freight.rate, advance: req.valid.advance, deduction: trip.freight.deduction }));
  await trip.save();
  await audit(req, { action: 'trip.advance', entity: 'Trip', entityId: trip._id, before: { advance: before }, after: { advance: req.valid.advance } });
  await reply(res, trip, req.user);
});

// ---------- Owner review ----------

/** Accept the system deduction and release the balance for payment. */
router.post('/:id/freight/approve', ownerOnly, async (req, res) => {
  const trip = await Trip.findById(req.params.id);
  if (!trip) throw notFound('Trip');
  if (trip.freight.status !== FREIGHT_STATUS.LOCKED) throw badRequest('Freight is not locked.');
  trip.freight.status = FREIGHT_STATUS.READY;
  trip.freight.reviewedBy = req.user._id;
  trip.freight.reviewedAt = new Date();
  trip.freight.reviewNote = req.body?.note;
  await trip.save();
  await audit(req, { action: 'trip.freight_approve', entity: 'Trip', entityId: trip._id, after: { deduction: trip.freight.deduction } });
  await reply(res, trip, req.user);
});

/** Owner override: remove the deduction (e.g. weighbridge fault proven). */
router.post('/:id/freight/waive', ownerOnly, validate(reasonSchema), async (req, res) => {
  const trip = await Trip.findById(req.params.id);
  if (!trip) throw notFound('Trip');
  if (![FREIGHT_STATUS.LOCKED, FREIGHT_STATUS.READY].includes(trip.freight.status)) throw badRequest('Freight cannot be changed now.');
  const before = { deduction: trip.freight.deduction, status: trip.freight.status };
  Object.assign(trip.freight, freightSettlement({ loadedQty: trip.loading.qty, rate: trip.freight.rate, advance: trip.freight.advance, deduction: 0 }));
  Object.assign(trip.freight, { status: FREIGHT_STATUS.READY, waived: true, reviewedBy: req.user._id, reviewedAt: new Date(), reviewNote: req.valid.reason });
  await trip.save();
  await audit(req, { action: 'trip.freight_waive', entity: 'Trip', entityId: trip._id, reason: req.valid.reason, before, after: { deduction: 0 } });
  await reply(res, trip, req.user);
});

router.post('/:id/freight/paid', ownerOnly, async (req, res) => {
  const trip = await Trip.findById(req.params.id);
  if (!trip) throw notFound('Trip');
  if (trip.freight.status !== FREIGHT_STATUS.READY) throw badRequest('Only cleared freight can be marked paid.');
  trip.freight.status = FREIGHT_STATUS.PAID;
  trip.freight.paidAt = new Date();
  await trip.save();
  await audit(req, { action: 'trip.freight_paid', entity: 'Trip', entityId: trip._id, after: { balance: trip.freight.balance } });
  await reply(res, trip, req.user);
});

router.post('/:id/correct', ownerOnly, validate(tripCorrectionSchema), async (req, res) => {
  const trip = await Trip.findById(req.params.id);
  if (!trip) throw notFound('Trip');
  if (trip.status === TRIP_STATUS.CANCELLED) throw badRequest('Trip is cancelled.');
  if ((req.valid.receiptGross || req.valid.receiptTare) && trip.status !== TRIP_STATUS.RECEIVED) throw badRequest('Truck is not received yet.');
  const { before, after } = await correctTrip({ trip, input: req.valid, user: req.user });
  await audit(req, { action: 'trip.correct', entity: 'Trip', entityId: trip._id, reason: req.valid.reason, before, after });
  await reply(res, trip, req.user);
});

router.post('/:id/cancel', ownerOnly, validate(reasonSchema), async (req, res) => {
  const trip = await Trip.findById(req.params.id);
  if (!trip) throw notFound('Trip');
  await cancelTrip({ trip, reason: req.valid.reason, user: req.user });
  await audit(req, { action: 'trip.cancel', entity: 'Trip', entityId: trip._id, reason: req.valid.reason });
  await reply(res, trip, req.user);
});

export default router;
