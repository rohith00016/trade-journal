import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IChecklistItem {
  _id: Types.ObjectId;
  label: string;
  description?: string;
  order: number;
  isRequired: boolean;
}

export interface IChecklistCategory {
  _id: Types.ObjectId;
  name: string;
  order: number;
  items: IChecklistItem[];
}

export interface IStrategyRules {
  riskRules: string[];
  tpRules: string[];
  breakEvenRules: string[];
}

export interface IStrategy extends Document {
  userId: Types.ObjectId;
  name: string;
  description?: string;
  markets: string[];
  timeframes: string[];
  rules: IStrategyRules;
  categories: IChecklistCategory[];
  version: number;
  parentStrategyId?: Types.ObjectId;
  rootStrategyId?: Types.ObjectId;
  isArchived: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const checklistItemSchema = new Schema<IChecklistItem>(
  {
    label: { type: String, required: true, trim: true },
    description: String,
    order: { type: Number, default: 0 },
    isRequired: { type: Boolean, default: false },
  },
  { _id: true }
);

const checklistCategorySchema = new Schema<IChecklistCategory>(
  {
    name: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 },
    items: { type: [checklistItemSchema], default: [] },
  },
  { _id: true }
);

const strategySchema = new Schema<IStrategy>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: String,
    markets: { type: [String], default: [] },
    timeframes: { type: [String], default: [] },
    rules: {
      riskRules: { type: [String], default: [] },
      tpRules: { type: [String], default: [] },
      breakEvenRules: { type: [String], default: [] },
    },
    categories: { type: [checklistCategorySchema], default: [] },
    version: { type: Number, default: 1 },
    parentStrategyId: { type: Schema.Types.ObjectId, ref: 'Strategy' },
    rootStrategyId: { type: Schema.Types.ObjectId, ref: 'Strategy' },
    isArchived: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

strategySchema.index({ userId: 1, name: 1, version: 1 });

export const Strategy = mongoose.model<IStrategy>('Strategy', strategySchema);
