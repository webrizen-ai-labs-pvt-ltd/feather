import mongoose from 'mongoose';
import { CONSIGNMENT_MODES, CONSIGNMENT_STATUS, UNITS } from '@feather/shared';

const { Schema } = mongoose;

/** Parent consignment: one railway rake, river barge or coastal ship. */
const consignmentSchema = new Schema(
  {
    mode: { type: String, enum: Object.values(CONSIGNMENT_MODES), required: true },
    referenceType: { type: String, enum: ['RR', 'BL'], required: true },
    referenceNo: { type: String, required: true, trim: true, uppercase: true },
    supplier: { type: String, required: true, trim: true },
    material: { type: Schema.Types.ObjectId, ref: 'Material', required: true },
    unit: { type: String, enum: Object.values(UNITS), required: true },
    /** Siding or port where it is unloaded. */
    location: { type: Schema.Types.ObjectId, ref: 'Location', required: true },
    declaredQty: { type: Number, required: true },
    wagonCount: { type: Number, default: 0 },
    freeTimeHours: { type: Number, required: true },
    demurrageRatePerWagonHour: { type: Number, default: 0 },
    purchaseRatePerUnit: { type: Number, default: 0 }, // owner only
    freightRatePerUnit: Number, // road freight per unit for child trips
    expectedAt: Date,
    placedAt: Date,
    releasedAt: Date,
    closedAt: Date,
    status: { type: String, enum: Object.values(CONSIGNMENT_STATUS), default: CONSIGNMENT_STATUS.EXPECTED, index: true },
    notes: String,

    // Running totals, kept in step by the trip service.
    tripCount: { type: Number, default: 0 },
    liftedQty: { type: Number, default: 0 },
    receivedTripCount: { type: Number, default: 0 },
    receivedLoadedQty: { type: Number, default: 0 },
    receivedQty: { type: Number, default: 0 },

    demurrage: {
      lastAlertStatus: String,
      finalPenalty: Number,
      finalOverHours: Number,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

consignmentSchema.index({ referenceType: 1, referenceNo: 1 }, { unique: true });

export const Consignment = mongoose.model('Consignment', consignmentSchema);
