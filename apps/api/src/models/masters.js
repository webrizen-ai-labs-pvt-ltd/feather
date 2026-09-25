import mongoose from 'mongoose';
import { LOCATION_TYPES, MATERIAL_KINDS, UNITS } from '@feather/shared';

const { Schema } = mongoose;
const opts = { timestamps: true };

const materialSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    kind: { type: String, enum: Object.values(MATERIAL_KINDS), required: true },
    unit: { type: String, enum: Object.values(UNITS), required: true },
    bagWeightKg: { type: Number, default: 50 },
    /** Allowed natural loss on the road, e.g. moisture in sand. Blank = global default. */
    transitLossTolerancePct: Number,
    /** Bulk density for brass ↔ MT conversion. */
    densityTPerM3: Number,
    /** Owner only. Used to value shortages and damage. Per MT or per bag. */
    landedCostPerUnit: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  opts,
);
materialSchema.pre('validate', function setUnit() {
  this.unit = this.kind === MATERIAL_KINDS.BAGGED ? UNITS.BAG : UNITS.MT;
});

const locationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: Object.values(LOCATION_TYPES), required: true, index: true },
    address: String,
    customer: { type: Schema.Types.ObjectId, ref: 'Customer' },
    /** Normal road time to reach this place. Used to spot delayed trucks. */
    expectedTransitHours: Number,
    active: { type: Boolean, default: true },
  },
  opts,
);
locationSchema.index({ name: 1, type: 1 }, { unique: true });

const transporterSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    phone: String,
    gstin: String,
    defaultRatePerUnit: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  opts,
);

const vehicleSchema = new Schema(
  {
    vehicleNo: { type: String, required: true, unique: true },
    transporter: { type: Schema.Types.ObjectId, ref: 'Transporter' },
    lastDriverName: String,
    lastDriverPhone: String,
    lastSeenAt: Date,
  },
  opts,
);

const customerSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    phone: String,
    email: String,
    gstin: String,
    /** Blank = global default (₹25 L). */
    creditLimit: Number,
    creditDays: Number,
    active: { type: Boolean, default: true },
  },
  opts,
);

export const Material = mongoose.model('Material', materialSchema);
export const Location = mongoose.model('Location', locationSchema);
export const Transporter = mongoose.model('Transporter', transporterSchema);
export const Vehicle = mongoose.model('Vehicle', vehicleSchema);
export const Customer = mongoose.model('Customer', customerSchema);
