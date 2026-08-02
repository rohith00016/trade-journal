import { asyncHandler, sendSuccess } from '../utils/api';
import { param } from '../utils/params';
import * as journalService from '../services/journal.service';
import type { JournalSource } from '../models/JournalEntry';

export const list = asyncHandler(async (req, res) => {
  const raw = String(req.query.source || 'combined');
  const source = (
    raw === 'taken' || raw === 'not_taken' || raw === 'combined' ? raw : 'combined'
  ) as JournalSource | 'combined';

  const result = await journalService.listJournalEntries(req.user!.id, {
    source,
    strategyId: req.query.strategyId as string | undefined,
    symbol: req.query.symbol as string | undefined,
    from: req.query.from ? new Date(String(req.query.from)) : undefined,
    to: req.query.to ? new Date(String(req.query.to)) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    page: req.query.page ? Number(req.query.page) : undefined,
  });
  sendSuccess(res, result);
});

export const exportJson = asyncHandler(async (req, res) => {
  const raw = String(req.query.source || 'combined');
  const source = (
    raw === 'taken' || raw === 'not_taken' || raw === 'combined' ? raw : 'combined'
  ) as JournalSource | 'combined';

  const data = await journalService.exportJournalEntries(req.user!.id, {
    source,
    strategyId: req.query.strategyId as string | undefined,
    symbol: req.query.symbol as string | undefined,
    from: req.query.from ? new Date(String(req.query.from)) : undefined,
    to: req.query.to ? new Date(String(req.query.to)) : undefined,
  });
  sendSuccess(res, data);
});

export const getOne = asyncHandler(async (req, res) => {
  const entry = await journalService.getJournalEntry(
    req.user!.id,
    param(req.params.id)
  );
  sendSuccess(res, entry);
});

export const create = asyncHandler(async (req, res) => {
  const entry = await journalService.createJournalEntry(req.user!.id, req.body);
  sendSuccess(res, entry, 201);
});

export const update = asyncHandler(async (req, res) => {
  const entry = await journalService.updateJournalEntry(
    req.user!.id,
    param(req.params.id),
    req.body
  );
  sendSuccess(res, entry);
});

export const remove = asyncHandler(async (req, res) => {
  await journalService.deleteJournalEntry(req.user!.id, param(req.params.id));
  sendSuccess(res, null, 200, 'Journal entry deleted');
});
