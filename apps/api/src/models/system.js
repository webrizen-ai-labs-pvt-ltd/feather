import mongoose from 'mongoose';
import { ALERT_SEVERITY, ALERT_TYPES, DEFAULT_SETTINGS, STOCK_GRADES, UNITS } from '@feather/shared';

const { Schema } = mongoose;

/** Every stock change is a row. Book stock = sum of rows. Rows are never edited. */
const stockMovementSchema = new Schema(
  {
    location: { type: Schema.Types.ObjectId, ref: 'Location', required: true },
    material: { type: Schema.Types.ObjectId, ref: 'Material', required: true },
    grade: { type: String, enum: Object.values(STOCK_GRADES), default: STOCK_GRADES.PRIME },
    qty: { type: Number, required: true },
    unit: { type: String, enum: Object.values(UNITS), required: true },
    reason: { type: String, enum: ['receipt', 'dispatch', 'adjustment', 'correction', 'cancel'], required: true },
    trip: { type: Schema.Types.ObjectId, ref: 'Trip' },
    stockCount: { type: Schema.Types.ObjectId, ref: 'StockCount' },
    note: String,
    by: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);
stockMovementSchema.index({ location: 1, material: 1, grade: 1 });

const stockCountSchema = new Schema(
  {
    location: { type: Schema.Types.ObjectId, ref: 'Location', required: true },
    material: { type: Schema.Types.ObjectId, ref: 'Material', required: true },
    grade: { type: String, enum: Object.values(STOCK_GRADES), default: STOCK_GRADES.PRIME },
    physicalQty: { type: Number, required: true },
    bookQty: Number,
    diffQty: Number,
    diffPct: Number,
    method: String,
    countedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    clientId: { type: String, unique: true, sparse: true },
    adjustedAt: Date,
    adjustedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

const alertSchema = new Schema(
  {
    type: { type: String, enum: Object.values(ALERT_TYPES), required: true },
    severity: { type: String, enum: Object.values(ALERT_SEVERITY), default: ALERT_SEVERITY.WARNING },
    title: { type: String, required: true },
    message: String,
    trip: { type: Schema.Types.ObjectId, ref: 'Trip' },
    consignment: { type: Schema.Types.ObjectId, ref: 'Consignment' },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer' },
    readAt: Date,
    emailedAt: Date,
  },
  { timestamps: true },
);
alertSchema.index({ readAt: 1, createdAt: -1 });

const auditSchema = new Schema(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User' },
    actorName: String,
    actorRole: String,
    action: { type: String, required: true },
    entity: { type: String, required: true },
    entityId: Schema.Types.ObjectId,
    reason: String,
    before: Schema.Types.Mixed,
    after: Schema.Types.Mixed,
    ip: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
auditSchema.index({ entity: 1, entityId: 1, createdAt: -1 });

const settingSchema = new Schema(
  {
    _id: { type: String, default: 'global' },
    ...Object.fromEntries(
      Object.entries(DEFAULT_SETTINGS).map(([k, v]) => [k, { type: Array.isArray(v) ? [String] : v.constructor, default: v }]),
    ),
  },
  { timestamps: true },
);

const counterSchema = new Schema({ _id: String, seq: { type: Number, default: 0 } });

export const StockMovement = mongoose.model('StockMovement', stockMovementSchema);
export const StockCount = mongoose.model('StockCount', stockCountSchema);
export const Alert = mongoose.model('Alert', alertSchema);
export const AuditLog = mongoose.model('AuditLog', auditSchema);
export const Setting = mongoose.model('Setting', settingSchema);
export const Counter = mongoose.model('Counter', counterSchema);
