import { Router } from 'express';
import {
  customerSchema,
  locationSchema,
  materialSchema,
  normalizeVehicleNo,
  ROLES,
  transporterSchema,
} from '@feather/shared';
import { requireRole } from '@/middleware/auth.js';
import { validate } from '@/middleware/validate.js';
import { Customer, Location, Material, Transporter, Vehicle } from '@/models/index.js';
import { audit } from '@/services/audit.js';
import { escapeRegex, notFound } from '@/utils/http.js';
import { presentMaterial } from '@/utils/present.js';

const router = Router();
const ownerOnly = requireRole(ROLES.OWNER);
const office = requireRole(ROLES.OWNER, ROLES.DISPATCH_OPERATOR);

/** Standard list / create / update routes for a master collection. */
function crud(path, Model, schema, { present = (d) => d, listFilter = () => ({}), canWrite = ownerOnly, populate } = {}) {
  router.get(`/${path}`, async (req, res) => {
    const filter = { ...listFilter(req) };
    if (req.query.active !== 'all') filter.active = true;
    let q = Model.find(filter).sort({ name: 1 });
    if (populate) q = q.populate(populate);
    const items = await q;
    res.json({ items: items.map((d) => present(d, req.user.role)) });
  });
  router.post(`/${path}`, canWrite, validate(schema), async (req, res) => {
    const doc = await Model.create(req.valid);
    await audit(req, { action: `${path}.create`, entity: Model.modelName, entityId: doc._id, after: req.valid });
    res.status(201).json({ item: present(doc, req.user.role) });
  });
  router.patch(`/${path}/:id`, canWrite, validate(schema), async (req, res) => {
    const doc = await Model.findById(req.params.id);
    if (!doc) throw notFound(Model.modelName);
    const before = doc.toObject();
    doc.set(req.valid);
    await doc.save();
    await audit(req, { action: `${path}.update`, entity: Model.modelName, entityId: doc._id, before, after: req.valid });
    res.json({ item: present(doc, req.user.role) });
  });
}

crud('materials', Material, materialSchema, { present: presentMaterial });
crud('locations', Location, locationSchema, {
  populate: { path: 'customer', select: 'name' },
  listFilter: (req) => (req.query.type ? { type: { $in: String(req.query.type).split(',') } } : {}),
});
crud('transporters', Transporter, transporterSchema, {
  present: (d, role) => {
    const t = d.toObject();
    if (role !== ROLES.OWNER && role !== ROLES.DISPATCH_OPERATOR) delete t.defaultRatePerUnit;
    return t;
  },
});
crud('customers', Customer, customerSchema, {
  present: (d, role) => {
    const c = d.toObject();
    if (role !== ROLES.OWNER && role !== ROLES.DISPATCH_OPERATOR) return { _id: c._id, name: c.name, active: c.active };
    return c;
  },
});

/** Truck lookup for the loading form — fills driver and transporter automatically. */
router.get('/vehicles/:vehicleNo', async (req, res) => {
  const vehicleNo = normalizeVehicleNo(req.params.vehicleNo);
  const vehicle = await Vehicle.findOne({ vehicleNo }).populate('transporter', 'name').lean();
  res.json({ vehicle });
});

router.get('/vehicles', office, async (req, res) => {
  const q = normalizeVehicleNo(String(req.query.q ?? ''));
  const vehicles = await Vehicle.find(q ? { vehicleNo: { $regex: escapeRegex(q) } } : {})
    .sort({ lastSeenAt: -1 })
    .limit(20)
    .populate('transporter', 'name')
    .lean();
  res.json({ items: vehicles });
});

export default router;
