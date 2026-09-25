import mongoose from 'mongoose';
import { FREIGHT_STATUS, TRIP_FLAGS, TRIP_SOURCE, TRIP_STATUS, UNITS } from '@feather/shared';

const { Schema } = mongoose;

const photoSchema = new Schema(
  { key: String, contentType: String, size: Number, lat: Number, lng: Number, accuracy: Number },
  { _id: false },
);

const weighmentSchema = {
  gross: Number,
  tare: Number,
  net: Number,
  /** Quantity in material unit: net MT for bulk, bag count for cement. */
  qty: Number,
  slipNo: String,
  photo: photoSchema,
  at: Date, // server time — never trusted from the phone
  deviceTime: Date,
  wasOffline: Boolean,
  by: { type: Schema.Types.ObjectId, ref: 'User' },
};

/** Child trip: one truck carrying part of a consignment (or a yard dispatch). */
const tripSchema = new Schema(
  {
    tripNo: { type: String, required: true, unique: true },
    challanNo: { type: String, unique: true, sparse: true },
    source: { type: String, enum: Object.values(TRIP_SOURCE), required: true },
    consignment: { type: Schema.Types.ObjectId, ref: 'Consignment', index: true },
    sourceLocation: { type: Schema.Types.ObjectId, ref: 'Location', required: true },
    destination: { type: Schema.Types.ObjectId, ref: 'Location', required: true, index: true },
    order: { type: Schema.Types.ObjectId, ref: 'Order', index: true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', index: true },
    material: { type: Schema.Types.ObjectId, ref: 'Material', required: true },
    unit: { type: String, enum: Object.values(UNITS), required: true },

    vehicleNo: { type: String, required: true, index: true },
    transporter: { type: Schema.Types.ObjectId, ref: 'Transporter', required: true, index: true },
    driverName: String,
    driverPhone: String,

    loading: { ...weighmentSchema, bags: Number },
    receipt: {
      ...weighmentSchema,
      grnNo: String,
      remarks: String,
      bags: {
        invoice: Number,
        sound: Number,
        burst: Number,
        lumpy: Number,
        underweight: Number,
        underweightAvgKg: Number,
        underweightShortKg: Number,
        missing: Number,
        excess: Number,
      },
    },

    expectedTransitHours: Number,
    status: { type: String, enum: Object.values(TRIP_STATUS), default: TRIP_STATUS.IN_TRANSIT, index: true },
    flags: [{ type: String, enum: Object.values(TRIP_FLAGS) }],
    delayAlertedAt: Date,
    breakdown: {
      active: { type: Boolean, default: false },
      note: String,
      at: Date,
      by: { type: Schema.Types.ObjectId, ref: 'User' },
      clearedAt: Date,
    },

    variance: {
      tolerancePct: Number,
      lossQty: Number,
      lossPct: Number,
      allowedQty: Number,
      excessLossQty: Number,
    },

    freight: {
      rate: { type: Number, default: 0 },
      amount: { type: Number, default: 0 },
      advance: { type: Number, default: 0 },
      deduction: { type: Number, default: 0 },
      deductionDetail: Schema.Types.Mixed,
      balance: { type: Number, default: 0 },
      recoverable: { type: Number, default: 0 },
      status: { type: String, enum: Object.values(FREIGHT_STATUS), default: FREIGHT_STATUS.ON_HOLD, index: true },
      reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      reviewedAt: Date,
      reviewNote: String,
      waived: Boolean,
      paidAt: Date,
    },

    credit: {
      override: { type: Schema.Types.ObjectId, ref: 'CreditOverride' },
      overrideReason: String,
      snapshot: Schema.Types.Mixed,
    },

    /** Idempotency keys from the phone so an offline retry never creates a duplicate. */
    clientId: { type: String, unique: true, sparse: true },
    receiptClientId: { type: String, unique: true, sparse: true },
    cancelReason: String,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

tripSchema.index({ status: 1, 'loading.at': -1 });
tripSchema.index({ 'receipt.at': -1 });
tripSchema.index({ vehicleNo: 1, 'loading.at': -1 });

export const Trip = mongoose.model('Trip', tripSchema);
