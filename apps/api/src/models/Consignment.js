import mongoose from 'mongoose';
import { CONSIGNMENT_MODES, CONSIGNMENT_STATUS, LATE_FEE_BASIS, PAPER_UNITS, UNITS } from '@feather/shared';

const { Schema } = mongoose;

/** Parent consignment: one railway rake, river barge or coastal ship. */
const consignmentSchema = new Schema(
  {
    mode: { type: String, enum: Object.values(CONSIGNMENT_MODES), required: true },
    referenceType: { type: String, enum: ['RR', 'BL'], required: true },
    referenceNo: { type: String, required: true, trim: true, uppercase: true },
    /** Who we bought it from (owner only). supplier = the seller's name, kept as text for exports and older shipments. */
    seller: { type: Schema.Types.ObjectId, ref: 'Seller', index: true },
    supplier: { type: String, required: true, trim: true },
    material: { type: Schema.Types.ObjectId, ref: 'Material', required: true },
    unit: { type: String, enum: Object.values(UNITS), required: true },
    /** Siding or port where it is unloaded. */
    location: { type: Schema.Types.ObjectId, ref: 'Location', required: true },
    /** Quantity in the product's unit (MT or bags) — what unloading is measured against. */
    declaredQty: { type: Number, required: true },
    /** As written on the paper: amount and unit (KG / Metric Tonne / Bags). */
    paperQty: Number,
    declaredUnit: { type: String, enum: Object.values(PAPER_UNITS) },
    wagonCount: { type: Number, default: 0 },
    freeTimeHours: { type: Number, required: true },
    /** Late fee after free hours: per hour / per day / one time, × wagons for a train. */
    demurrageBasis: { type: String, enum: Object.values(LATE_FEE_BASIS), default: LATE_FEE_BASIS.HOUR },
    demurrageRate: Number,
    /** Older shipments: late fee per wagon per hour (used when demurrageRate is not set). */
    demurrageRatePerWagonHour: { type: Number, default: 0 },
    /** Total on the seller's bill (owner only). purchaseRatePerUnit is worked out from it. */
    purchaseAmount: Number,
    purchaseRatePerUnit: { type: Number, default: 0 }, // owner only
    freightRatePerUnit: Number, // older shipments: road freight per unit for child trips
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
