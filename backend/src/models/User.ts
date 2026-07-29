import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  avatarUrl?: string;
  preferences: {
    timezone: string;
    currency: string;
    defaultRisk: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, select: false },
    avatarUrl: String,
    preferences: {
      timezone: { type: String, default: 'UTC' },
      currency: { type: String, default: 'USD' },
      defaultRisk: { type: Number, default: 100 },
    },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>('User', userSchema);
