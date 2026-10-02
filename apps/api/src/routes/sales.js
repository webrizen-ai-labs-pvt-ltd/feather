import { Router } from 'express';
import {
  aging,
  ALERT_SEVERITY,
  ALERT_TYPES,
  creditOverrideSchema,
  formatINR,
  invoiceSchema,
  LOCATION_TYPES,
  orderSchema,
  paymentSchema,
  reasonSchema,
  ROLES,
} from '@feather/shared';
import { requireRole } from '@/middleware/auth.js';
import { validate } from '@/middleware/validate.js';
import { CreditOverride, Customer, Invoice, Location, Material, Order, Payment } from '@/models/index.js';
import { raiseAlert } from '@/services/alerts.js';
import { audit } from '@/services/audit.js';
import { nextNumber } from '@/services/counters.js';
import { activeOverride, allocatePayment, applyAdvances, customerCredit } from '@/services/credit.js';
import { badRequest, notFound } from '@/utils/http.js';
import { creditOverview } from '@/services/reports.js';
import { presentOrder } from '@/utils/present.js';

const router = Router();
const { OWNER, DISPATCH_OPERATOR } = ROLES;
const office = requireRole(OWNER, DISPATCH_OPERATOR);
const ownerOnly = requireRole(OWNER);

// ---------- Orders ----------

router.get('/orders', requireRole(OWNER, DISPATCH_OPERATOR, ROLES.SIDING_SUPERVISOR), async (req, res) => {
  const filter = {};
  // Siding supervisors only need open orders (to send a truck straight to site); rates are hidden.
  const status = req.user.role === ROLES.SIDING_SUPERVISOR ? 'open' : req.query.status;
  if (status) filter.status = { $in: String(status).split(',') };
  if (req.query.customer) filter.customer = req.query.customer;
  const orders = await Order.find(filter)
    .sort({ createdAt: -1 })
    .limit(300)
    .populate('customer', 'name')
    .populate('material', 'name unit')
    .populate('deliverySite', 'name')
    .lean();
  res.json({ items: orders.map((o) => presentOrder(o, req.user.role)) });
});

router.post('/orders', office, validate(orderSchema), async (req, res) => {
  const [customer, material, site] = await Promise.all([
    Customer.findById(req.valid.customer),
    Material.findById(req.valid.material),
    Location.findById(req.valid.deliverySite),
  ]);
  if (!customer?.active) throw badRequest('Choose an active customer.');
  if (!material) throw badRequest('Choose the material.');
  if (!site || site.type !== LOCATION_TYPES.CUSTOMER_SITE || String(site.customer) !== String(customer._id)) {
    throw badRequest('Choose a delivery site that belongs to this customer.');
  }
  const order = await Order.create({ ...req.valid, orderNo: await nextNumber('SO'), createdBy: req.user._id });
  const credit = await customerCredit(customer);
  await audit(req, { action: 'order.create', entity: 'Order', entityId: order._id, after: req.valid });
  res.status(201).json({ item: order, credit });
});

router.post('/orders/:id/status', office, async (req, res) => {
  const status = req.body?.status;
  if (!['open', 'completed', 'cancelled'].includes(status)) throw badRequest('Bad status.');
  const order = await Order.findById(req.params.id);
  if (!order) throw notFound('Order');
  const before = order.status;
  order.status = status;
  await order.save();
  await audit(req, { action: 'order.status', entity: 'Order', entityId: order._id, before: { status: before }, after: { status } });
  res.json({ item: order });
});

// ---------- Customer credit ----------

/** Credit position for every customer — owner dashboard and dispatch desk. */
router.get('/credit', office, async (_req, res) => {
  res.json({ items: await creditOverview() });
});

router.get('/customers/:id/ledger', ownerOnly, async (req, res) => {
  const customer = await Customer.findById(req.params.id).lean();
  if (!customer) throw notFound('Customer');
  const [invoices, payments, overrides, credit, sites] = await Promise.all([
    Invoice.find({ customer: customer._id }).sort({ invoiceDate: -1 }).limit(500).populate('trip', 'tripNo challanNo vehicleNo').lean(),
    Payment.find({ customer: customer._id }).sort({ receivedAt: -1 }).limit(500).lean(),
    CreditOverride.find({ customer: customer._id }).sort({ createdAt: -1 }).limit(50).populate('grantedBy', 'name').lean(),
    customerCredit(customer),
    Location.find({ customer: customer._id, type: LOCATION_TYPES.CUSTOMER_SITE }).lean(),
  ]);
  res.json({ customer, credit, aging: aging(invoices), invoices, payments, overrides, sites });
});

router.post('/customers/:id/payments', ownerOnly, validate(paymentSchema), async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw notFound('Customer');
  const { allocations, unallocated } = await allocatePayment(customer._id, req.valid.amount);
  const payment = await Payment.create({
    customer: customer._id,
    amount: req.valid.amount,
    receivedAt: req.valid.receivedAt ?? new Date(),
    reference: req.valid.reference,
    allocations,
    unallocated,
    recordedBy: req.user._id,
  });
  await audit(req, { action: 'payment.create', entity: 'Payment', entityId: payment._id, after: req.valid });
  res.status(201).json({ item: payment, credit: await customerCredit(customer) });
});

/** Manual invoice, e.g. opening balance from the old books. */
router.post('/customers/:id/invoices', ownerOnly, validate(invoiceSchema), async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw notFound('Customer');
  const invoice = await Invoice.create({
    invoiceNo: await nextNumber('INV'),
    customer: customer._id,
    amount: req.valid.amount,
    invoiceDate: req.valid.invoiceDate ?? new Date(),
    reference: req.valid.reference,
  });
  await applyAdvances(invoice);
  await audit(req, { action: 'invoice.create', entity: 'Invoice', entityId: invoice._id, after: req.valid });
  res.status(201).json({ item: invoice, credit: await customerCredit(customer) });
});

/** Owner override of the credit hard-stop, limited by time and number of challans. */
router.post('/customers/:id/override', ownerOnly, validate(creditOverrideSchema), async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) throw notFound('Customer');
  const existing = await activeOverride(customer._id);
  if (existing) {
    existing.revokedAt = new Date();
    await existing.save();
  }
  const override = await CreditOverride.create({
    customer: customer._id,
    reason: req.valid.reason,
    grantedBy: req.user._id,
    validUntil: new Date(Date.now() + req.valid.hours * 3_600_000),
    maxUses: req.valid.maxUses,
  });
  const credit = await customerCredit(customer);
  await audit(req, { action: 'credit.override', entity: 'Customer', entityId: customer._id, reason: req.valid.reason, after: { hours: req.valid.hours, maxUses: req.valid.maxUses } });
  await raiseAlert({
    type: ALERT_TYPES.CREDIT_OVERRIDE,
    severity: ALERT_SEVERITY.INFO,
    title: `Allowed anyway given for ${customer.name}`,
    lines: [
      `${req.user.name} allowed ${req.valid.maxUses} delivery note(s) for the next ${req.valid.hours} hours.`,
      `Reason: ${req.valid.reason}`,
      `Current total owed: ${formatINR(credit.exposure)} against limit ${formatINR(credit.creditLimit)}.`,
    ],
    customer: customer._id,
  });
  res.status(201).json({ item: override });
});

router.post('/overrides/:id/revoke', ownerOnly, validate(reasonSchema), async (req, res) => {
  const override = await CreditOverride.findById(req.params.id);
  if (!override) throw notFound('Override');
  override.revokedAt = new Date();
  await override.save();
  await audit(req, { action: 'credit.override_revoke', entity: 'CreditOverride', entityId: override._id, reason: req.valid.reason });
  res.json({ item: override });
});

export default router;
