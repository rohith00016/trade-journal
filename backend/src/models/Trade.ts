import mongoose, { Document, Schema, Types } from 'mongoose';

export type TradeDirection = 'long' | 'short';
export type TradeSession = 'asia' | 'london' | 'newyork' | 'overlap' | 'other';
export type PsychologyTag =
  | 'fomo'
  | 'revenge'
  | 'early_exit'
  | 'late_entry'
  | 'oversized_risk'
  | 'rule_violation'
  | 'moving_stop';

export interface IChecklistResponse {
  categoryId: string;
  categoryName: string;
  itemId: string;
  itemLabel: string;
  checked: boolean;
}

export interface ITrade extends Document {
  userId: Types.ObjectId;
  accountId: Types.ObjectId;
  strategyId?: Types.ObjectId;
  strategyVersion?: number;
  strategyName?: string;
  date: Date;
  symbol: string;
  direction: TradeDirection;
  entry?: number;
  exit?: number;
  stopLoss?: number;
  takeProfit?: number;
  risk: number;
  contracts: number;
  resultUsd: number;
  resultR: number;
  maximumRr?: number;
  commission: number;
  session: TradeSession;
  screenshots: string[];
  notes?: string;
  checklist: IChecklistResponse[];
  psychologyTags: PsychologyTag[];
  createdAt: Date;
  updatedAt: Date;
}

const checklistResponseSchema = new Schema<IChecklistResponse>(
  {
    categoryId: { type: String, required: true },
    categoryName: { type: String, required: true },
    itemId: { type: String, required: true },
    itemLabel: { type: String, required: true },
    checked: { type: Boolean, default: false },
  },
  { _id: false }
);

const tradeSchema = new Schema<ITrade>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
    strategyId: { type: Schema.Types.ObjectId, ref: 'Strategy' },
    strategyVersion: Number,
    strategyName: String,
    date: { type: Date, required: true, index: true },
    symbol: { type: String, required: true, uppercase: true, trim: true },
    direction: { type: String, enum: ['long', 'short'], required: true },
    entry: Number,
    exit: Number,
    stopLoss: Number,
    takeProfit: Number,
    risk: { type: Number, required: true },
    contracts: { type: Number, required: true, default: 1 },
    resultUsd: { type: Number, required: true },
    resultR: { type: Number, required: true },
    maximumRr: Number,
    commission: { type: Number, default: 0 },
    session: {
      type: String,
      enum: ['asia', 'london', 'newyork', 'overlap', 'other'],
      default: 'other',
    },
    screenshots: { type: [String], default: [] },
    notes: String,
    checklist: { type: [checklistResponseSchema], default: [] },
    psychologyTags: {
      type: [
        {
          type: String,
          enum: [
            'fomo',
            'revenge',
            'early_exit',
            'late_entry',
            'oversized_risk',
            'rule_violation',
            'moving_stop',
          ],
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

tradeSchema.index({ userId: 1, date: -1 });
tradeSchema.index({ userId: 1, strategyId: 1 });
tradeSchema.index({ userId: 1, symbol: 1 });

export const Trade = mongoose.model<ITrade>('Trade', tradeSchema);
