import { Trade, Strategy } from '../models';
import { getOwnedAccount } from './account.service';
import { notFound } from '../utils/api';

type TradeInput = {
  accountId: string;
  strategyId?: string;
  date: Date;
  symbol: string;
  direction: 'long' | 'short';
  entry?: number;
  exit?: number;
  stopLoss?: number;
  takeProfit?: number;
  risk: number;
  contracts: number;
  resultUsd: number;
  resultR: number;
  maximumRr?: number;
  commission?: number;
  session?: 'asia' | 'london' | 'newyork' | 'overlap' | 'other';
  screenshots?: string[];
  notes?: string;
  checklist?: Array<{
    categoryId: string;
    categoryName: string;
    itemId: string;
    itemLabel: string;
    checked: boolean;
  }>;
  psychologyTags?: Array<
    | 'fomo'
    | 'revenge'
    | 'early_exit'
    | 'late_entry'
    | 'oversized_risk'
    | 'rule_violation'
    | 'moving_stop'
  >;
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

export async function listTrades(
  userId: string,
  filters: {
    accountId?: string;
    strategyId?: string;
    symbol?: string;
    from?: Date;
    to?: Date;
    limit?: number;
    page?: number;
  } = {}
) {
  const query: Record<string, unknown> = { userId };
  if (filters.accountId) query.accountId = filters.accountId;
  if (filters.strategyId) query.strategyId = filters.strategyId;
  if (filters.symbol) query.symbol = filters.symbol.toUpperCase();
  if (filters.from || filters.to) {
    query.date = {
      ...(filters.from ? { $gte: filters.from } : {}),
      ...(filters.to ? { $lte: filters.to } : {}),
    };
  }

  const limit = Math.min(filters.limit ?? 50, 200);
  const page = filters.page ?? 1;
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Trade.find(query).sort({ date: -1, createdAt: -1 }).skip(skip).limit(limit),
    Trade.countDocuments(query),
  ]);

  return { items, total, page, limit, pages: Math.ceil(total / limit) };
}

export async function getTrade(userId: string, tradeId: string) {
  const trade = await Trade.findOne({ _id: tradeId, userId });
  if (!trade) throw notFound('Trade');
  return trade;
}

export async function createTrade(userId: string, data: TradeInput) {
  await getOwnedAccount(userId, data.accountId);
  const strategyFields = await enrichStrategyFields(userId, data.strategyId);

  return Trade.create({
    ...data,
    ...strategyFields,
    userId,
    symbol: data.symbol.toUpperCase(),
  });
}

export async function updateTrade(
  userId: string,
  tradeId: string,
  data: Partial<TradeInput>
) {
  if (data.accountId) {
    await getOwnedAccount(userId, data.accountId);
  }

  const strategyFields = data.strategyId
    ? await enrichStrategyFields(userId, data.strategyId)
    : {};

  const trade = await Trade.findOneAndUpdate(
    { _id: tradeId, userId },
    {
      ...data,
      ...strategyFields,
      ...(data.symbol ? { symbol: data.symbol.toUpperCase() } : {}),
    },
    { new: true }
  );
  if (!trade) throw notFound('Trade');
  return trade;
}

export async function deleteTrade(userId: string, tradeId: string) {
  const trade = await Trade.findOneAndDelete({ _id: tradeId, userId });
  if (!trade) throw notFound('Trade');
  return trade;
}
