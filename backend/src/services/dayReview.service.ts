import { DayReview } from '../models';
import { notFound } from '../utils/api';

type DayReviewInput = {
  date: Date;
  marketNotes?: string;
  emotionalState?: string;
  grade?: 'A' | 'B' | 'C' | 'D' | 'F';
  setups?: Array<{
    time: string;
    strategyId?: string;
    strategyName?: string;
    valid: boolean;
    taken: boolean;
    result?: 'win' | 'loss' | 'be' | 'missed';
    maximumRr?: number;
    screenshot?: string;
    notes?: string;
    checklist?: Array<{
      categoryId: string;
      categoryName: string;
      itemId: string;
      itemLabel: string;
      checked: boolean;
    }>;
  }>;
};

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export async function listDayReviews(userId: string, from?: Date, to?: Date) {
  const query: Record<string, unknown> = { userId };
  if (from || to) {
    query.date = {
      ...(from ? { $gte: startOfDay(from) } : {}),
      ...(to ? { $lte: startOfDay(to) } : {}),
    };
  }
  return DayReview.find(query).sort({ date: -1 });
}

export async function getDayReview(userId: string, date: Date) {
  return DayReview.findOne({
    userId,
    date: startOfDay(date),
  });
}

export async function upsertDayReview(userId: string, data: DayReviewInput) {
  const date = startOfDay(data.date);
  return DayReview.findOneAndUpdate(
    { userId, date },
    { ...data, date, userId },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
}

export async function deleteDayReview(userId: string, date: Date) {
  const review = await DayReview.findOneAndDelete({
    userId,
    date: startOfDay(date),
  });
  if (!review) throw notFound('Day review');
  return review;
}
