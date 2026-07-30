import mongoose, { Document, Schema, Types } from 'mongoose';
import {
  IChecklistResponse,
  PsychologyTag,
  TradeDirection,
  TradeSession,
} from './Trade';

export type JournalSource = 'taken' | 'not_taken';
export type SetupOutcome = 'win' | 'loss' | 'be';

export interface IJournalEntry extends Document {
  userId: Types.ObjectId;
  source: JournalSource;
  date: Date;
  accountId?: Types.ObjectId;
  strategyId?: Types.ObjectId;
  strategyVersion?: number;
  strategyName?: string;
  symbol?: string;
  direction?: TradeDirection;
  entry?: number;
  exit?: number;
  stopLoss?: number;
  takeProfit?: number;
  risk?: number;
  contracts?: number;
  resultUsd?: number;
  resultR?: number;
  maximumRr?: number;
  /** Max R reached before price first retested entry. Empty if no meaningful retest. */
  maxBeforeRetest?: number;
  commission?: number;
  session?: TradeSession;
  screenshots: string[];
  notes?: string;
  checklist: IChecklistResponse[];
  psychologyTags: PsychologyTag[];
  /** Not-taken: checklist-derived validity */
  valid?: boolean;
  /** Not-taken: chart outcome (win/loss/BE) */
  outcome?: SetupOutcome;
  /** Idempotent migration keys */
  legacyTradeId?: Types.ObjectId;
  legacySetupKey?: string;
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

const journalEntrySchema = new Schema<IJournalEntry>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    source: { type: String, enum: ['taken', 'not_taken'], required: true, index: true },
    date: { type: Date, required: true, index: true },
    accountId: { type: Schema.Types.ObjectId, ref: 'Account' },
    strategyId: { type: Schema.Types.ObjectId, ref: 'Strategy' },
    strategyVersion: Number,
    strategyName: String,
    symbol: { type: String, uppercase: true, trim: true },
    direction: { type: String, enum: ['long', 'short'] },
    entry: Number,
    exit: Number,
    stopLoss: Number,
    takeProfit: Number,
    risk: Number,
    contracts: Number,
    resultUsd: Number,
    resultR: Number,
    maximumRr: Number,
    maxBeforeRetest: Number,
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
    valid: Boolean,
    outcome: { type: String, enum: ['win', 'loss', 'be'] },
    legacyTradeId: { type: Schema.Types.ObjectId, index: true },
    legacySetupKey: { type: String, index: true },
  },
  { timestamps: true }
);

journalEntrySchema.index({ userId: 1, date: -1 });
journalEntrySchema.index({ userId: 1, source: 1, date: -1 });
journalEntrySchema.index(
  { userId: 1, legacyTradeId: 1 },
  { unique: true, partialFilterExpression: { legacyTradeId: { $type: 'objectId' } } }
);
journalEntrySchema.index(
  { userId: 1, legacySetupKey: 1 },
  { unique: true, partialFilterExpression: { legacySetupKey: { $type: 'string' } } }
);

export const JournalEntry = mongoose.model<IJournalEntry>(
  'JournalEntry',
  journalEntrySchema
);
