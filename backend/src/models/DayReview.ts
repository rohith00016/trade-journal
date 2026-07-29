import mongoose, { Document, Schema, Types } from 'mongoose';
import { IChecklistResponse } from './Trade';

export interface IReviewedSetup {
  _id: Types.ObjectId;
  time: string;
  strategyId?: Types.ObjectId;
  strategyName?: string;
  valid: boolean;
  taken: boolean;
  result?: 'win' | 'loss' | 'be' | 'missed';
  maximumRr?: number;
  screenshot?: string;
  notes?: string;
  checklist: IChecklistResponse[];
}

export interface IDayReview extends Document {
  userId: Types.ObjectId;
  date: Date;
  marketNotes?: string;
  emotionalState?: string;
  grade?: 'A' | 'B' | 'C' | 'D' | 'F';
  setups: IReviewedSetup[];
  createdAt: Date;
  updatedAt: Date;
}

const reviewedSetupSchema = new Schema<IReviewedSetup>(
  {
    time: { type: String, required: true },
    strategyId: { type: Schema.Types.ObjectId, ref: 'Strategy' },
    strategyName: String,
    valid: { type: Boolean, default: false },
    taken: { type: Boolean, default: false },
    result: { type: String, enum: ['win', 'loss', 'be', 'missed'] },
    // missed kept for old docs; new reviews use win/loss/be only as hypothetical
    maximumRr: Number,
    screenshot: String,
    notes: String,
    checklist: {
      type: [
        {
          categoryId: String,
          categoryName: String,
          itemId: String,
          itemLabel: String,
          checked: Boolean,
        },
      ],
      default: [],
    },
  },
  { _id: true }
);

const dayReviewSchema = new Schema<IDayReview>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: Date, required: true },
    marketNotes: String,
    emotionalState: String,
    grade: { type: String, enum: ['A', 'B', 'C', 'D', 'F'] },
    setups: { type: [reviewedSetupSchema], default: [] },
  },
  { timestamps: true }
);

dayReviewSchema.index({ userId: 1, date: 1 }, { unique: true });

export const DayReview = mongoose.model<IDayReview>('DayReview', dayReviewSchema);
