import { JournalEntry, Trade, DayReview, Strategy, Account } from '../models';
import { IJournalEntry, JournalSource, SetupOutcome } from '../models/JournalEntry';
import { getOwnedAccount } from './account.service';
import { badRequest, notFound } from '../utils/api';
import { Types } from 'mongoose';

type ChecklistRow = {
  categoryId: string;
  categoryName: string;
  itemId: string;
  itemLabel: string;
  checked: boolean;
};

export type JournalEntryInput = {
  source: JournalSource;
  date: Date;
  accountId?: string;
  strategyId?: string;
  symbol?: string;
  direction?: 'long' | 'short';
  entry?: number;
  exit?: number;
  stopLoss?: number;
  takeProfit?: number;
  risk?: number;
  contracts?: number;
  resultUsd?: number;
  resultR?: number;
  maximumRr?: number;
  maxBeforeRetest?: number;
  retestCount?: number;
  maxAfterFirstRetest?: number;
  commission?: number;
  session?: 'asia' | 'london' | 'newyork' | 'overlap' | 'other';
  screenshots?: string[];
  notes?: string;
  checklist?: ChecklistRow[];
  psychologyTags?: Array<
    | 'fomo'
    | 'revenge'
    | 'early_exit'
    | 'late_entry'
    | 'oversized_risk'
    | 'rule_violation'
    | 'moving_stop'
  >;
  valid?: boolean;
  outcome?: SetupOutcome;
};

async function enrichStrategyFields(userId: string, strategyId?: string) {
  if (!strategyId) return {};
  const strategy = await Strategy.findOne({ _id: strategyId, userId });
  if (!strategy) return {};
  return {
    strategyId: strategy._id,
    strategyVersion: strategy.version,
    strategyName: strategy.name,
  };
}

function outcomeFromR(r: number): SetupOutcome {
  if (r > 0) return 'win';
  if (r < 0) return 'loss';
  return 'be';
}

function assertTradeCore(data: JournalEntryInput) {
  if (!data.symbol) throw badRequest('symbol is required');
  if (!data.direction) throw badRequest('direction is required');
  if (data.resultR == null || !Number.isFinite(data.resultR)) {
    throw badRequest('resultR is required (use 0 for breakeven)');
  }
}

function assertTaken(data: JournalEntryInput) {
  assertTradeCore(data);
}

function assertNotTaken(data: JournalEntryInput) {
  assertTradeCore(data);
}

export async function migrateLegacyJournal(userId: string) {
  const trades = await Trade.find({ userId });
  for (const t of trades) {
    const exists = await JournalEntry.exists({
      userId,
      legacyTradeId: t._id,
    });
    if (exists) continue;
    await JournalEntry.create({
      userId,
      source: 'taken',
      legacyTradeId: t._id,
      accountId: t.accountId,
      strategyId: t.strategyId,
      strategyVersion: t.strategyVersion,
      strategyName: t.strategyName,
      date: t.date,
      symbol: t.symbol,
      direction: t.direction,
      entry: t.entry,
      exit: t.exit,
      stopLoss: t.stopLoss,
      takeProfit: t.takeProfit,
      risk: t.risk,
      contracts: t.contracts,
      resultUsd: t.resultUsd,
      resultR: t.resultR,
      maximumRr: t.maximumRr,
      commission: t.commission,
      session: t.session,
      screenshots: t.screenshots ?? [],
      notes: t.notes,
      checklist: t.checklist ?? [],
      psychologyTags: t.psychologyTags ?? [],
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    });
  }

  const reviews = await DayReview.find({ userId });
  for (const review of reviews) {
    for (const setup of review.setups || []) {
      if (setup.taken) continue;
      const setupId = String(setup._id);
      const legacySetupKey = `${String(review._id)}:${setupId}`;
      const exists = await JournalEntry.exists({ userId, legacySetupKey });
      if (exists) continue;

      const day = new Date(review.date);
      const [hh = '12', mm = '0'] = (setup.time || '12:00').split(':');
      const at = new Date(day);
      at.setUTCHours(Number(hh) || 12, Number(mm) || 0, 0, 0);

      const outcome =
        setup.result === 'win' || setup.result === 'loss' || setup.result === 'be'
          ? setup.result
          : undefined;

      await JournalEntry.create({
        userId,
        source: 'not_taken',
        legacySetupKey,
        date: at,
        strategyId: setup.strategyId,
        strategyName: setup.strategyName,
        maximumRr: setup.maximumRr,
        screenshots: setup.screenshot ? [setup.screenshot] : [],
        notes: setup.notes,
        checklist: setup.checklist ?? [],
        valid: setup.valid,
        outcome,
        psychologyTags: [],
      });
    }
  }
}

export async function listJournalEntries(
  userId: string,
  filters: {
    source?: JournalSource | 'combined';
    strategyId?: string;
    symbol?: string;
    from?: Date;
    to?: Date;
    limit?: number;
    page?: number;
  } = {}
) {
  await migrateLegacyJournal(userId);

  const query: Record<string, unknown> = { userId };
  if (filters.source === 'taken' || filters.source === 'not_taken') {
    query.source = filters.source;
  }
  if (filters.strategyId) query.strategyId = filters.strategyId;
  if (filters.symbol) query.symbol = filters.symbol.toUpperCase();
  if (filters.from || filters.to) {
    query.date = {
      ...(filters.from ? { $gte: filters.from } : {}),
      ...(filters.to ? { $lte: filters.to } : {}),
    };
  }

  const limit = Math.min(filters.limit ?? 100, 500);
  const page = filters.page ?? 1;
  const skip = (page - 1) * limit;

  const [items, total, takenCount, notTakenCount] = await Promise.all([
    JournalEntry.find(query).sort({ date: -1, createdAt: -1 }).skip(skip).limit(limit),
    JournalEntry.countDocuments(query),
    JournalEntry.countDocuments({ userId, source: 'taken' }),
    JournalEntry.countDocuments({ userId, source: 'not_taken' }),
  ]);

  return {
    items,
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
    counts: {
      taken: takenCount,
      notTaken: notTakenCount,
      combined: takenCount + notTakenCount,
    },
  };
}

/** Full journal dump for download — omits screenshot URLs only. */
export async function exportJournalEntries(
  userId: string,
  filters: {
    source?: JournalSource | 'combined';
    strategyId?: string;
    symbol?: string;
    from?: Date;
    to?: Date;
  } = {}
) {
  await migrateLegacyJournal(userId);

  const query: Record<string, unknown> = { userId };
  if (filters.source === 'taken' || filters.source === 'not_taken') {
    query.source = filters.source;
  }
  if (filters.strategyId) query.strategyId = filters.strategyId;
  if (filters.symbol) query.symbol = filters.symbol.toUpperCase();
  if (filters.from || filters.to) {
    query.date = {
      ...(filters.from ? { $gte: filters.from } : {}),
      ...(filters.to ? { $lte: filters.to } : {}),
    };
  }

  const docs = await JournalEntry.find(query)
    .sort({ date: 1, createdAt: 1 })
    .select('-screenshots -__v')
    .lean();

  const entries = docs.map((e) => ({
    _id: String(e._id),
    source: e.source,
    date: e.date,
    accountId: e.accountId ? String(e.accountId) : undefined,
    strategyId: e.strategyId ? String(e.strategyId) : undefined,
    strategyVersion: e.strategyVersion,
    strategyName: e.strategyName,
    symbol: e.symbol,
    direction: e.direction,
    entry: e.entry,
    exit: e.exit,
    stopLoss: e.stopLoss,
    takeProfit: e.takeProfit,
    risk: e.risk,
    contracts: e.contracts,
    resultUsd: e.resultUsd,
    resultR: e.resultR,
    maximumRr: e.maximumRr ?? null,
    maxBeforeRetest: e.maxBeforeRetest ?? null,
    commission: e.commission,
    session: e.session,
    notes: e.notes,
    checklist: e.checklist ?? [],
    psychologyTags: e.psychologyTags ?? [],
    valid: e.valid,
    outcome: e.outcome,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  }));

  return {
    exportedAt: new Date().toISOString(),
    source: filters.source ?? 'combined',
    count: entries.length,
    entries,
  };
}

export async function getJournalEntry(userId: string, id: string) {
  await migrateLegacyJournal(userId);
  const entry = await JournalEntry.findOne({ _id: id, userId });
  if (!entry) throw notFound('Journal entry');
  return entry;
}

export async function createJournalEntry(userId: string, data: JournalEntryInput) {
  if (data.source === 'taken') {
    assertTaken(data);
  } else {
    assertNotTaken(data);
  }

  const strategyFields = await enrichStrategyFields(userId, data.strategyId);
  const outcome = outcomeFromR(data.resultR!);

  let accountId = data.accountId;
  if (data.source === 'taken' && !accountId) {
    const account = await ensurePrimaryAccount(userId);
    accountId = String(account._id);
  } else if (accountId) {
    await getOwnedAccount(userId, accountId);
  }

  return JournalEntry.create({
    ...data,
    ...strategyFields,
    userId,
    accountId: accountId || undefined,
    outcome,
    resultUsd: data.resultUsd,
    risk: data.risk,
    contracts: data.contracts,
    commission: data.commission ?? 0,
    maximumRr: data.maximumRr,
    maxBeforeRetest: data.maxBeforeRetest,
    retestCount: data.retestCount,
    maxAfterFirstRetest: data.maxAfterFirstRetest,
    symbol: data.symbol ? data.symbol.toUpperCase() : undefined,
    screenshots: data.screenshots ?? [],
    checklist: data.checklist ?? [],
    psychologyTags: data.psychologyTags ?? [],
  });
}

export async function updateJournalEntry(
  userId: string,
  id: string,
  data: Partial<JournalEntryInput>
) {
  const existing = await JournalEntry.findOne({ _id: id, userId });
  if (!existing) throw notFound('Journal entry');

  const nextSource = data.source ?? existing.source;
  const merged: JournalEntryInput = {
    source: nextSource,
    date: data.date ?? existing.date,
    accountId: data.accountId ?? existing.accountId?.toString(),
    strategyId: data.strategyId ?? existing.strategyId?.toString(),
    symbol: data.symbol ?? existing.symbol,
    direction: data.direction ?? existing.direction,
    entry: data.entry ?? existing.entry,
    exit: data.exit ?? existing.exit,
    stopLoss: data.stopLoss ?? existing.stopLoss,
    takeProfit: data.takeProfit ?? existing.takeProfit,
    risk: data.risk ?? existing.risk,
    contracts: data.contracts ?? existing.contracts,
    resultUsd: data.resultUsd ?? existing.resultUsd,
    resultR: data.resultR ?? existing.resultR,
    maximumRr: data.maximumRr ?? existing.maximumRr,
    maxBeforeRetest: data.maxBeforeRetest ?? existing.maxBeforeRetest,
    retestCount: data.retestCount ?? existing.retestCount,
    maxAfterFirstRetest: data.maxAfterFirstRetest ?? existing.maxAfterFirstRetest,
    commission: data.commission ?? existing.commission,
    session: data.session ?? existing.session,
    screenshots: data.screenshots ?? existing.screenshots,
    notes: data.notes ?? existing.notes,
    checklist: data.checklist ?? existing.checklist,
    psychologyTags: data.psychologyTags ?? existing.psychologyTags,
    valid: data.valid ?? existing.valid,
    outcome: data.outcome ?? existing.outcome,
  };

  if (nextSource === 'taken') {
    assertTaken(merged);
  } else {
    assertNotTaken(merged);
  }

  if (merged.accountId) {
    await getOwnedAccount(userId, merged.accountId);
  } else if (nextSource === 'taken' && !existing.accountId) {
    const account = await ensurePrimaryAccount(userId);
    merged.accountId = String(account._id);
  }

  const strategyFields = await enrichStrategyFields(userId, merged.strategyId);
  const outcome = outcomeFromR(merged.resultR!);

  existing.set({
    ...merged,
    ...strategyFields,
    outcome,
    symbol: merged.symbol ? merged.symbol.toUpperCase() : undefined,
  });
  await existing.save();
  return existing;
}

export async function deleteJournalEntry(userId: string, id: string) {
  const entry = await JournalEntry.findOneAndDelete({ _id: id, userId });
  if (!entry) throw notFound('Journal entry');
  return entry;
}

export async function listTakenForAnalytics(
  userId: string,
  filters: {
    accountId?: string;
    strategyId?: string;
    from?: Date;
    to?: Date;
  } = {}
) {
  await migrateLegacyJournal(userId);
  const query: Record<string, unknown> = { userId, source: 'taken' };
  if (filters.accountId) query.accountId = filters.accountId;
  if (filters.strategyId) query.strategyId = filters.strategyId;
  if (filters.from || filters.to) {
    query.date = {
      ...(filters.from ? { $gte: filters.from } : {}),
      ...(filters.to ? { $lte: filters.to } : {}),
    };
  }
  return JournalEntry.find(query).sort({ date: -1 });
}

export async function ensurePrimaryAccount(userId: string) {
  const existing = await Account.findOne({ userId }).sort({ createdAt: 1 });
  if (existing) return existing;
  return Account.create({
    userId,
    name: 'Primary',
    type: 'demo',
    startingBalance: 50000,
  });
}

export function asTakenDocs(entries: IJournalEntry[]) {
  return entries.filter((e) => e.source === 'taken' && typeof e.resultR === 'number');
}

export function isObjectIdString(id?: string) {
  return Boolean(id && Types.ObjectId.isValid(id));
}
