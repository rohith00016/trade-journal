import { asyncHandler, sendSuccess } from '../utils/api';
import {
  getDashboardAnalytics,
  getPlaybook,
  getUnifiedInsights,
  type AnalyticsSource,
  type TimeSlotMinutes,
} from '../services/analytics.service';
import { generateAiInsights } from '../services/gemini.service';

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

export const playbook = asyncHandler(async (req, res) => {
  const raw = String(req.query.source || 'combined');
  const source = (
    raw === 'taken' || raw === 'not_taken' || raw === 'combined' ? raw : 'combined'
  ) as AnalyticsSource;
  const slotRaw = Number(req.query.slotMinutes || 30);
  const slotMinutes = (
    slotRaw === 15 || slotRaw === 60 ? slotRaw : 30
  ) as TimeSlotMinutes;

  const startMin =
    req.query.startMin === undefined || req.query.startMin === ''
      ? null
      : Number(req.query.startMin);
  const setupIndex =
    req.query.setupIndex === undefined || req.query.setupIndex === ''
      ? null
      : Number(req.query.setupIndex);

  const data = await getPlaybook(req.user!.id, {
    source,
    slotMinutes,
    startMin: Number.isFinite(startMin as number) ? startMin : null,
    setupIndex: Number.isFinite(setupIndex as number) ? setupIndex : null,
  });
  sendSuccess(res, data);
});

export const aiInsights = asyncHandler(async (req, res) => {
  const raw = String(
    (req.query.source as string | undefined) ||
      (req.body && typeof req.body === 'object' && 'source' in req.body
        ? String((req.body as { source?: string }).source)
        : '') ||
      'combined'
  );
  const source = (
    raw === 'taken' || raw === 'not_taken' || raw === 'combined' ? raw : 'combined'
  ) as AnalyticsSource;
  const data = await generateAiInsights(req.user!.id, source);
  sendSuccess(res, data);
});
