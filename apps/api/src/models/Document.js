import mongoose from 'mongoose';
import { DOCUMENT_KINDS } from '@feather/shared';

const { Schema } = mongoose;

/**
 * A file attached to a record (a shipment's bill, RR / BL…). The file lives in private storage;
 * viewers get short-lived signed links. Removing hides it but keeps the file and who / why, for History.
 */
const documentSchema = new Schema(
  {
    entity: { type: String, required: true }, // e.g. 'Consignment'
    entityId: { type: Schema.Types.ObjectId, required: true },
    kind: { type: String, enum: Object.values(DOCUMENT_KINDS), default: DOCUMENT_KINDS.OTHER },
    name: { type: String, required: true }, // original file name
    key: { type: String, required: true },
    contentType: String,
    size: Number,
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    removedAt: Date,
    removedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    removeReason: String,
  },
  { timestamps: true },
);
documentSchema.index({ entity: 1, entityId: 1, createdAt: -1 });

export const Document = mongoose.model('Document', documentSchema);
