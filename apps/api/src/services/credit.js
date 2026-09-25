import { creditCheck, roundMoney, TRIP_STATUS } from '@feather/shared';
import { CreditOverride, Customer, Invoice, Payment, Trip } from '@/models/index.js';
import { getSettings } from '@/services/settings.js';

/** Value of material already sent to this customer but not yet invoiced. */
async function unbilledValue(customerId) {
  const trips = await Trip.find(
    { customer: customerId, status: TRIP_STATUS.IN_TRANSIT, order: { $exists: true } },
    'loading.qty order',
  )
    .populate('order', 'ratePerUnit')
    .lean();
  return roundMoney(trips.reduce((sum, t) => sum + (t.loading?.qty ?? 0) * (t.order?.ratePerUnit ?? 0), 0));
}

export async function customerCredit(customerOrId, newValue = 0) {
  const customer =
    typeof customerOrId === 'object' && customerOrId.name ? customerOrId : await Customer.findById(customerOrId).lean();
  const settings = await getSettings();
  const [invoices, unbilled] = await Promise.all([
    Invoice.find({ customer: customer._id, $expr: { $gt: ['$amount', '$paidAmount'] } }, 'amount paidAmount invoiceDate').lean(),
    unbilledValue(customer._id),
  ]);
  return creditCheck({
    creditLimit: customer.creditLimit ?? settings.defaultCreditLimit,
    creditDays: customer.creditDays ?? settings.defaultCreditDays,
    invoices,
    unbilledValue: unbilled,
    newValue,
  });
}

export function activeOverride(customerId) {
  return CreditOverride.findOne({
    customer: customerId,
    revokedAt: null,
    validUntil: { $gt: new Date() },
    $expr: { $lt: ['$uses', '$maxUses'] },
  }).sort({ createdAt: -1 });
}

/** Atomically use one slot of an override. Returns null if none left. */
export function consumeOverride(overrideId, tripId) {
  return CreditOverride.findOneAndUpdate(
    { _id: overrideId, revokedAt: null, validUntil: { $gt: new Date() }, $expr: { $lt: ['$uses', '$maxUses'] } },
    { $inc: { uses: 1 }, $push: { trips: tripId } },
    { new: true },
  );
}

/**
 * Apply a payment to the oldest unpaid invoices first.
 * Returns the allocations and any amount left over (advance).
 */
export async function allocatePayment(customerId, amount) {
  let left = roundMoney(amount);
  const allocations = [];
  const invoices = await Invoice.find({ customer: customerId, $expr: { $gt: ['$amount', '$paidAmount'] } }).sort({ invoiceDate: 1 });
  for (const inv of invoices) {
    if (left <= 0) break;
    const take = Math.min(left, roundMoney(inv.amount - inv.paidAmount));
    inv.paidAmount = roundMoney(inv.paidAmount + take);
    await inv.save();
    allocations.push({ invoice: inv._id, amount: take });
    left = roundMoney(left - take);
  }
  return { allocations, unallocated: left };
}

/** Use any unallocated advance payments against a newly created invoice. */
export async function applyAdvances(invoice) {
  const payments = await Payment.find({ customer: invoice.customer, unallocated: { $gt: 0 } }).sort({ receivedAt: 1 });
  for (const p of payments) {
    const due = roundMoney(invoice.amount - invoice.paidAmount);
    if (due <= 0) break;
    const take = Math.min(due, p.unallocated);
    p.unallocated = roundMoney(p.unallocated - take);
    p.allocations.push({ invoice: invoice._id, amount: take });
    invoice.paidAmount = roundMoney(invoice.paidAmount + take);
    await p.save();
  }
  await invoice.save();
}
