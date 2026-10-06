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
    /**
     * Lot = the shipment this stock arrived in (first in, first out; shelf life from its arrival).
     * null = stock with no shipment. Missing = row saved before lots were tracked (shared out oldest first when read).
     */
    lot: { type: Schema.Types.ObjectId, ref: 'Consignment' },
    trip: { type: Schema.Types.ObjectId, ref: 'Trip' },
    stockCount: { type: Schema.Types.ObjectId, ref: 'StockCount' },
    note: String,
    by: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);
stockMovementSchema.index({ location: 1, material: 1, grade: 1 });
stockMovementSchema.index({ trip: 1 });

/**
 * Stock ID: one per shipment lot per warehouse (+ product), e.g. 04102026-02 = second stock to arrive at
 * any warehouse on 4 Oct 2026. Made when the lot's first stock arrives there; never changes.
 * lot null = older stock with no shipment.
 */
const stockLotSchema = new Schema(
  {
    stockId: { type: String, required: true, unique: true },
    location: { type: Schema.Types.ObjectId, ref: 'Location', required: true },
    material: { type: Schema.Types.ObjectId, ref: 'Material', required: true },
    lot: { type: Schema.Types.ObjectId, ref: 'Consignment', default: null },
    /** When the first stock of this lot arrived at this warehouse. */
    firstInAt: { type: Date, required: true },
  },
  { timestamps: true },
);
stockLotSchema.index({ location: 1, material: 1, lot: 1 }, { unique: true });

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
    /** Quantity posted to system stock when the owner accepted the count. */
    adjustedQty: Number,
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
export const StockLot = mongoose.model('StockLot', stockLotSchema);
export const Alert = mongoose.model('Alert', alertSchema);
export const AuditLog = mongoose.model('AuditLog', auditSchema);
export const Setting = mongoose.model('Setting', settingSchema);
export const Counter = mongoose.model('Counter', counterSchema);
