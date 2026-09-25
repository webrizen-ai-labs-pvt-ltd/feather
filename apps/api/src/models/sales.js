import mongoose from 'mongoose';

const { Schema } = mongoose;
const opts = { timestamps: true };

const orderSchema = new Schema(
  {
    orderNo: { type: String, required: true, unique: true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    material: { type: Schema.Types.ObjectId, ref: 'Material', required: true },
    deliverySite: { type: Schema.Types.ObjectId, ref: 'Location', required: true },
    qty: { type: Number, required: true },
    ratePerUnit: { type: Number, required: true },
    dispatchedQty: { type: Number, default: 0 },
    deliveredQty: { type: Number, default: 0 },
    status: { type: String, enum: ['open', 'completed', 'cancelled'], default: 'open', index: true },
    notes: String,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  opts,
);

const invoiceSchema = new Schema(
  {
    invoiceNo: { type: String, required: true, unique: true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    trip: { type: Schema.Types.ObjectId, ref: 'Trip' },
    order: { type: Schema.Types.ObjectId, ref: 'Order' },
    amount: { type: Number, required: true },
    paidAmount: { type: Number, default: 0 },
    invoiceDate: { type: Date, required: true },
    reference: String,
    auto: { type: Boolean, default: false },
  },
  opts,
);
invoiceSchema.index({ customer: 1, invoiceDate: 1 });

const paymentSchema = new Schema(
  {
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    amount: { type: Number, required: true },
    receivedAt: { type: Date, required: true },
    reference: String,
    unallocated: { type: Number, default: 0 },
    allocations: [{ _id: false, invoice: { type: Schema.Types.ObjectId, ref: 'Invoice' }, amount: Number }],
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  opts,
);

/** Owner permission to dispatch to a blocked customer for a limited time / number of challans. */
const creditOverrideSchema = new Schema(
  {
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    reason: { type: String, required: true },
    grantedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    validUntil: { type: Date, required: true },
    maxUses: { type: Number, default: 1 },
    uses: { type: Number, default: 0 },
    trips: [{ type: Schema.Types.ObjectId, ref: 'Trip' }],
    revokedAt: Date,
  },
  opts,
);

export const Order = mongoose.model('Order', orderSchema);
export const Invoice = mongoose.model('Invoice', invoiceSchema);
export const Payment = mongoose.model('Payment', paymentSchema);
export const CreditOverride = mongoose.model('CreditOverride', creditOverrideSchema);
