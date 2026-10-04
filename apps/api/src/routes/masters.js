import { Router } from 'express';
import {
  canSeeLoadingCosts,
  customerSchema,
  locationSchema,
  materialSchema,
  normalizeVehicleNo,
  ROLES,
  sellerSchema,
  transporterSchema,
  UNLOADING_POINT_TYPES,
} from '@feather/shared';
import { requireRole } from '@/middleware/auth.js';
import { validate } from '@/middleware/validate.js';
import { Customer, Location, Material, Seller, Transporter, Vehicle } from '@/models/index.js';
import { audit } from '@/services/audit.js';
import { badRequest, escapeRegex, notFound } from '@/utils/http.js';
import { presentMaterial } from '@/utils/present.js';

const router = Router();
const ownerOnly = requireRole(ROLES.OWNER);
const office = requireRole(ROLES.OWNER, ROLES.DISPATCH_OPERATOR);

/**
 * Standard list / create / update routes for a master collection.
 * check(data) runs before every save for rules that need the database.
 * canRead guards the list (default: any logged-in user).
 */
function crud(path, Model, schema, { present = (d) => d, listFilter = () => ({}), canRead = (_req, _res, next) => next(), canWrite = ownerOnly, populate, check = async () => {} } = {}) {
  router.get(`/${path}`, canRead, async (req, res) => {
    const filter = { ...listFilter(req) };
    if (req.query.active !== 'all') filter.active = true;
    let q = Model.find(filter).sort({ name: 1 });
    if (populate) q = q.populate(populate);
    const items = await q;
    res.json({ items: items.map((d) => present(d, req.user.role)) });
  });
  router.post(`/${path}`, canWrite, validate(schema), async (req, res) => {
    await check(req.valid);
    const doc = await Model.create(req.valid);
    if (populate) await doc.populate(populate);
    await audit(req, { action: `${path}.create`, entity: Model.modelName, entityId: doc._id, after: req.valid });
    res.status(201).json({ item: present(doc, req.user.role) });
  });
  router.patch(`/${path}/:id`, canWrite, validate(schema), async (req, res) => {
    const doc = await Model.findById(req.params.id);
    if (!doc) throw notFound(Model.modelName);
    await check(req.valid, doc);
    const before = doc.toObject();
    doc.set(req.valid);
    await doc.save();
    if (populate) await doc.populate(populate);
    await audit(req, { action: `${path}.update`, entity: Model.modelName, entityId: doc._id, before, after: req.valid });
    res.json({ item: present(doc, req.user.role) });
  });
}

crud('materials', Material, materialSchema, {
  present: presentMaterial,
  populate: { path: 'seller', select: 'name active' },
  // The seller must be on your Sellers list; a newly chosen one must be active.
  check: async (data, existing) => {
    const seller = await Seller.findById(data.seller, 'active').lean();
    const unchanged = existing && String(existing.seller) === data.seller;
    if (!seller || (!seller.active && !unchanged)) {
      throw badRequest('Choose an active seller from your Sellers list.', { code: 'VALIDATION', fields: { seller: 'Choose an active seller' } });
    }
  },
});
crud('locations', Location, locationSchema, {
  populate: [
    { path: 'customer', select: 'name' },
    { path: 'routes.from', select: 'name type' },
  ],
  listFilter: (req) => (req.query.type ? { type: { $in: String(req.query.type).split(',') } } : {}),
  check: async (data, existing) => {
    if (!data.routes.length) return;
    const ids = data.routes.map((r) => r.from);
    const points = await Location.find({ _id: { $in: ids }, type: { $in: UNLOADING_POINT_TYPES } }, '_id').lean();
    const valid = new Set(points.map((p) => String(p._id)));
    const fields = {};
    data.routes.forEach((r, i) => {
      if (!valid.has(r.from) || r.from === String(existing?._id)) fields[`routes.${i}.from`] = 'Choose a railway station or port';
    });
    if (Object.keys(fields).length) throw badRequest('Distance can only be from a railway station or port.', { code: 'VALIDATION', fields });
  },
  // Office and loading staff see the price per truck and labour costs (the loading form shows them); receiving staff do not.
  present: (d, role) => {
    const l = d.toObject ? d.toObject() : d;
    if (!canSeeLoadingCosts(role)) {
      l.routes = l.routes?.map(({ pricePerTruck: _hidden, ...r }) => r);
      delete l.labourCostPerWagon;
      delete l.labourCostPerTruck;
      delete l.labourCostPerKg;
    }
    return l;
  },
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

// Sellers (who we buy from) are owner-only — nobody else can list, add or change them.
crud('sellers', Seller, sellerSchema, { canRead: ownerOnly });

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
