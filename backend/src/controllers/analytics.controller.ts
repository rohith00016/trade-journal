import { asyncHandler, sendSuccess } from '../utils/api';
import {
  getDashboardAnalytics,
  getUnifiedInsights,
  type AnalyticsSource,
} from '../services/analytics.service';

export const dashboard = asyncHandler(async (req, res) => {
  const data = await getDashboardAnalytics(req.user!.id, {
    accountId: req.query.accountId as string | undefined,
    strategyId: req.query.strategyId as string | undefined,
    from: req.query.from ? new Date(String(req.query.from)) : undefined,
    to: req.query.to ? new Date(String(req.query.to)) : undefined,
  });
  sendSuccess(res, data);
});

export const insights = asyncHandler(async (req, res) => {
  const raw = String(req.query.source || 'combined');
  const source = (
    raw === 'taken' || raw === 'not_taken' || raw === 'combined' ? raw : 'combined'
  ) as AnalyticsSource;
  const data = await getUnifiedInsights(req.user!.id, source);
  sendSuccess(res, data);
});
