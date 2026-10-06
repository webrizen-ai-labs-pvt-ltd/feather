import { Router } from 'express';
import {
  CONSIGNMENT_STATUS,
  consignmentSchema,
  documentUploadSchema,
  LOCATION_TYPES,
  paperQtyToUnit,
  reasonSchema,
  REFERENCE_TYPE_BY_MODE,
  ROLES,
  round,
  shipmentDemurrage,
  TRIP_STATUS,
  wagonMarkSchema,
} from '@feather/shared';
import { requireRole } from '@/middleware/auth.js';
import { documentUpload } from '@/middleware/upload.js';
import { validate } from '@/middleware/validate.js';
import { Consignment, Document, Location, Material, Seller, Trip } from '@/models/index.js';
import { audit } from '@/services/audit.js';
import { getSettings } from '@/services/settings.js';
import { fileUrl, putFile } from '@/services/storage.js';
import { badRequest, forbidden, notFound } from '@/utils/http.js';
import { presentConsignment, presentTrips } from '@/utils/present.js';

const router = Router();
const { OWNER, DISPATCH_OPERATOR, SIDING_SUPERVISOR } = ROLES;

export function withClock(c, settings) {
  return {
    ...c,
    clock: shipmentDemurrage(c, { warnHours: settings.demurrageWarnHours }),
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
  if (req.query.seller && req.user.role === OWNER) filter.seller = req.query.seller;
  const [items, settings] = await Promise.all([
    Consignment.find(filter)
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(req.query.limit) || 100, 500))
      .populate('material', 'name unit kind bagWeightKg')
      .populate('location', 'name type')
      .populate('seller', 'name active')
      .lean(),
    getSettings(),
  ]);
  res.json({ items: items.map((c) => withClock(presentConsignment(c, req.user.role), settings)) });
});

router.get('/:id', async (req, res) => {
  const c = await Consignment.findOne({ _id: req.params.id, ...scope(req.user) })
    .populate('material')
    .populate('location', 'name type')
    .populate('seller', 'name active')
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

/**
 * Who the shipment was bought from. The owner picks a seller (blank = the product's seller);
 * other roles always get the product's seller. supplier is kept as the seller's name.
 */
async function resolveSeller({ data, material, user, existing }) {
  const picked = user.role === OWNER ? data.seller : undefined;
  const id = picked ?? material.seller;
  if (id) {
    const seller = await Seller.findById(id, 'name active').lean();
    const unchanged = existing && String(existing.seller) === String(id);
    if (!seller || (picked && !seller.active && !unchanged)) {
      throw badRequest('Choose an active seller from your Sellers list.', { code: 'VALIDATION', fields: { seller: 'Choose an active seller' } });
    }
    return { seller: seller._id, supplier: seller.name };
  }
  // Older data: a product with no seller yet — keep the typed supplier name.
  const supplier = data.supplier ?? existing?.supplier;
  if (!supplier) throw badRequest('Choose the seller.', { code: 'VALIDATION', fields: { seller: 'Choose the seller' } });
  return { seller: undefined, supplier };
}

/**
 * Quantity from the paper (KG / Metric Tonne / Bags) → the product's unit. declaredQty is then in MT or bags,
 * and the paper amount and unit are kept as written. Without a unit, the quantity is already in the product's unit.
 */
function paperQuantity(data, material) {
  if (!data.declaredUnit) return { paperQty: undefined, declaredUnit: undefined };
  try {
    const declaredQty = paperQtyToUnit(data.declaredQty, data.declaredUnit, material);
    if (!(declaredQty > 0)) throw new RangeError('Quantity is too small for this product.');
    return { paperQty: data.declaredQty, declaredUnit: data.declaredUnit, declaredQty };
  } catch (err) {
    throw badRequest(err.message, { code: 'VALIDATION', fields: { declaredUnit: err.message } });
  }
}

/** The seller's total bill, plus the per-unit rate worked out from it (exports and older screens use the rate). */
const purchaseFields = ({ purchaseAmount, declaredQty }) => ({
  purchaseAmount,
  purchaseRatePerUnit: purchaseAmount != null && declaredQty > 0 ? round(purchaseAmount / declaredQty, 2) : 0,
});

router.post('/', requireRole(OWNER, DISPATCH_OPERATOR), validate(consignmentSchema), async (req, res) => {
  const data = { ...req.valid };
  const [material, location] = await Promise.all([Material.findById(data.material), Location.findById(data.location)]);
  if (!material) throw badRequest('Choose the material.');
  if (!location || ![LOCATION_TYPES.SIDING, LOCATION_TYPES.PORT].includes(location.type)) {
    throw badRequest('Choose a railway station or port.');
  }
  // Purchase amount and the seller's invoice number are owner only.
  if (req.user.role !== OWNER) {
    delete data.purchaseAmount;
    delete data.invoiceNo;
  }
  Object.assign(data, paperQuantity(data, material));
  Object.assign(data, purchaseFields(data));
  Object.assign(data, await resolveSeller({ data, material, user: req.user }));
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
  const material = await Material.findById(req.valid.material);
  if (!material) throw badRequest('Choose the material.');
  const before = c.toObject();
  const seller = await resolveSeller({ data: req.valid, material, user: req.user, existing: c });
  const qty = { ...req.valid, ...paperQuantity(req.valid, material) };
  const changes = { ...qty, ...purchaseFields(qty), ...seller, referenceType: REFERENCE_TYPE_BY_MODE[req.valid.mode] };
  // The truck rate is no longer on the form — editing must not wipe a rate an older shipment already has.
  if (changes.freightRatePerUnit === undefined) delete changes.freightRatePerUnit;
  c.set(changes);
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

/**
 * Train: mark one wagon fully empty, or undo a wrong tap. Only while the shipment is unloading.
 * Repeating the same mark changes nothing, so an offline retry is safe.
 */
router.post('/:id/wagons', requireRole(OWNER, DISPATCH_OPERATOR, SIDING_SUPERVISOR), validate(wagonMarkSchema), async (req, res) => {
  const c = await loadForAction(req);
  const { no, emptied, deviceTime, wasOffline } = req.valid;
  if (!(c.wagonCount > 0)) throw badRequest('This shipment has no wagons.');
  if (no > c.wagonCount) throw badRequest(`This train has ${c.wagonCount} wagons.`, { fields: { no: `1 to ${c.wagonCount}` } });
  if (c.status !== CONSIGNMENT_STATUS.PLACED) throw badRequest('Wagons can be marked only while the shipment is unloading.');
  const result = emptied
    ? await Consignment.updateOne(
        { _id: c._id, 'wagonsEmptied.no': { $ne: no } },
        { $push: { wagonsEmptied: { no, at: new Date(), deviceTime, wasOffline, by: req.user._id } } },
      )
    : await Consignment.updateOne({ _id: c._id }, { $pull: { wagonsEmptied: { no } } });
  // History only when something changed (a repeated tap or offline retry changes nothing).
  if (result.modifiedCount) {
    await audit(req, { action: emptied ? 'consignment.wagon_emptied' : 'consignment.wagon_unmarked', entity: 'Consignment', entityId: c._id, after: { wagon: no } });
  }
  const fresh = await Consignment.findById(c._id).lean();
  res.json({ item: presentConsignment(fresh, req.user.role) });
});

/** Rake empty and handed back to Railways / ship sailed. Final demurrage is fixed. */
router.post('/:id/release', requireRole(OWNER, DISPATCH_OPERATOR, SIDING_SUPERVISOR), async (req, res) => {
  const c = await loadForAction(req);
  if (c.status !== CONSIGNMENT_STATUS.PLACED) throw badRequest('Only an unloading shipment can be released.');
  c.releasedAt = new Date();
  c.status = CONSIGNMENT_STATUS.RELEASED;
  const clock = shipmentDemurrage(c);
  c.set('demurrage.finalPenalty', clock.projectedPenalty);
  c.set('demurrage.finalOverHours', clock.projectedOverHours);
  await c.save();
  await audit(req, { action: 'consignment.release', entity: 'Consignment', entityId: c._id, after: { releasedAt: c.releasedAt, penalty: clock.projectedPenalty } });
  res.json({ item: presentConsignment(c, req.user.role) });
});

// ---------- Documents (seller bill, RR / BL…) — owner only, they show purchase prices ----------

const presentDocument = async (d) => ({
  _id: d._id,
  kind: d.kind,
  name: d.name,
  contentType: d.contentType,
  size: d.size,
  uploadedBy: d.uploadedBy,
  createdAt: d.createdAt,
  url: await fileUrl(d.key, { fileName: d.name }),
});

router.get('/:id/documents', requireRole(OWNER), async (req, res) => {
  const docs = await Document.find({ entity: 'Consignment', entityId: req.params.id, removedAt: null })
    .sort({ createdAt: -1 })
    .populate('uploadedBy', 'name')
    .lean();
  res.json({ items: await Promise.all(docs.map(presentDocument)) });
});

router.post('/:id/documents', requireRole(OWNER), documentUpload, validate(documentUploadSchema), async (req, res) => {
  const c = await Consignment.findById(req.params.id, 'referenceNo').lean();
  if (!c) throw notFound('Shipment');
  if (!req.file) throw badRequest('Choose a file to attach.', { fields: { file: 'Required' } });
  // Browsers send file names as UTF-8 but multer reads them as latin1.
  const name = Buffer.from(req.file.originalname, 'latin1').toString('utf8').slice(0, 200);
  const stored = await putFile({ folder: 'documents', buffer: req.file.buffer, contentType: req.file.mimetype });
  const doc = await Document.create({ entity: 'Consignment', entityId: c._id, kind: req.valid.kind, name, ...stored, uploadedBy: req.user._id });
  await audit(req, { action: 'consignment.document_add', entity: 'Consignment', entityId: c._id, after: { document: doc._id, name, kind: doc.kind, size: doc.size } });
  await doc.populate('uploadedBy', 'name');
  res.status(201).json({ item: await presentDocument(doc.toObject()) });
});

/** Hidden from the list, but the file and who removed it / why are kept for History. */
router.post('/:id/documents/:docId/remove', requireRole(OWNER), validate(reasonSchema), async (req, res) => {
  const doc = await Document.findOne({ _id: req.params.docId, entity: 'Consignment', entityId: req.params.id, removedAt: null });
  if (!doc) throw notFound('Document');
  Object.assign(doc, { removedAt: new Date(), removedBy: req.user._id, removeReason: req.valid.reason });
  await doc.save();
  await audit(req, { action: 'consignment.document_remove', entity: 'Consignment', entityId: doc.entityId, reason: req.valid.reason, before: { document: doc._id, name: doc.name, kind: doc.kind } });
  res.json({ ok: true });
});

/**
 * Remove a shipment entered by mistake (or demo data). Only while no truck was ever loaded from it —
 * trips, stock and payments point back to their shipment. The full record is kept in History.
 */
router.post('/:id/delete', requireRole(OWNER), validate(reasonSchema), async (req, res) => {
  const c = await Consignment.findById(req.params.id);
  if (!c) throw notFound('Shipment');
  const trips = await Trip.countDocuments({ consignment: c._id });
  if (trips) throw badRequest(`${trips} truck${trips === 1 ? ' is' : 's are'} linked to this shipment, so it cannot be deleted. Close it instead.`);
  await audit(req, { action: 'consignment.delete', entity: 'Consignment', entityId: c._id, reason: req.valid.reason, before: c.toObject() });
  await c.deleteOne();
  // Its documents go with it (files kept, marked removed with the same reason).
  await Document.updateMany(
    { entity: 'Consignment', entityId: c._id, removedAt: null },
    { removedAt: new Date(), removedBy: req.user._id, removeReason: `Shipment deleted: ${req.valid.reason}` },
  );
  res.json({ ok: true });
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
