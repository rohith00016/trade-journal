import mongoose, { Document, Schema, Types } from 'mongoose';

export type AccountType = 'live' | 'demo' | 'prop';

export interface IAccount extends Document {
  userId: Types.ObjectId;
  name: string;
  type: AccountType;
  currency: string;
  startingBalance: number;
  isActive: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const accountSchema = new Schema<IAccount>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['live', 'demo', 'prop'], default: 'demo' },
    currency: { type: String, default: 'USD' },
    startingBalance: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    notes: String,
  },
  { timestamps: true }
);

accountSchema.index({ userId: 1, name: 1 }, { unique: true });

export const Account = mongoose.model<IAccount>('Account', accountSchema);
