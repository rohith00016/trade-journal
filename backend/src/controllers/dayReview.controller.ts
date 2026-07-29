import { asyncHandler, sendSuccess } from '../utils/api';
import { param } from '../utils/params';
import * as dayReviewService from '../services/dayReview.service';

export const list = asyncHandler(async (req, res) => {
  const reviews = await dayReviewService.listDayReviews(
    req.user!.id,
    req.query.from ? new Date(String(req.query.from)) : undefined,
    req.query.to ? new Date(String(req.query.to)) : undefined
  );
  sendSuccess(res, reviews);
});

export const getByDate = asyncHandler(async (req, res) => {
  const review = await dayReviewService.getDayReview(
    req.user!.id,
    new Date(param(req.params.date))
  );
  sendSuccess(res, review);
});

export const upsert = asyncHandler(async (req, res) => {
  const review = await dayReviewService.upsertDayReview(req.user!.id, req.body);
  sendSuccess(res, review);
});

export const remove = asyncHandler(async (req, res) => {
  await dayReviewService.deleteDayReview(
    req.user!.id,
    new Date(param(req.params.date))
  );
  sendSuccess(res, null, 200, 'Day review deleted');
});
