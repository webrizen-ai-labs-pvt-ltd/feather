import mongoose from 'mongoose';
import { ROLES } from '@feather/shared';

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: Object.values(ROLES), required: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    pinHash: { type: String, select: false },
    /** Sidings / yards / sites this person works at. Empty = all (office roles). */
    locations: [{ type: Schema.Types.ObjectId, ref: 'Location' }],
    active: { type: Boolean, default: true },
    /** Bumped on PIN reset or deactivation — invalidates every issued token. */
    tokenVersion: { type: Number, default: 0 },
    pinFailures: { type: Number, default: 0 },
    pinLockedUntil: Date,
    lastLoginAt: Date,
  },
  { timestamps: true },
);

userSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: 'string' } } });
userSchema.index({ phone: 1 }, { unique: true, partialFilterExpression: { phone: { $type: 'string' } } });

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.pinHash;
    delete ret.tokenVersion;
    delete ret.pinFailures;
    delete ret.__v;
    return ret;
  },
});

export const User = mongoose.model('User', userSchema);
