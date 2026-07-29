import { Types } from 'mongoose';
import { Strategy } from '../models';
import { AppError } from '../types';
import { notFound } from '../utils/api';

type StrategyInput = {
  name: string;
  description?: string;
  markets?: string[];
  timeframes?: string[];
  rules?: {
    riskRules: string[];
    tpRules: string[];
    breakEvenRules: string[];
  };
  categories?: Array<{
    _id?: string;
    name: string;
    order: number;
    items: Array<{
      _id?: string;
      label: string;
      description?: string;
      order: number;
      isRequired: boolean;
    }>;
  }>;
  isActive?: boolean;
};

function withOrders(input: StrategyInput) {
  const categories = (input.categories ?? []).map((cat, catIndex) => ({
    ...cat,
    order: cat.order ?? catIndex,
    items: (cat.items ?? []).map((item, itemIndex) => ({
      ...item,
      order: item.order ?? itemIndex,
    })),
  }));
  return { ...input, categories };
}

export async function listStrategies(
  userId: string,
  options: { includeArchived?: boolean } = {}
) {
  const filter: Record<string, unknown> = { userId };
  if (!options.includeArchived) {
    filter.isArchived = false;
  }
  return Strategy.find(filter).sort({ updatedAt: -1 });
}

export async function getStrategy(userId: string, strategyId: string) {
  const strategy = await Strategy.findOne({ _id: strategyId, userId });
  if (!strategy) throw notFound('Strategy');
  return strategy;
}

export async function createStrategy(userId: string, data: StrategyInput) {
  const payload = withOrders(data);
  const strategy = await Strategy.create({
    ...payload,
    userId,
    version: 1,
  });
  strategy.rootStrategyId = strategy._id as Types.ObjectId;
  await strategy.save();
  return strategy;
}

export async function updateStrategy(
  userId: string,
  strategyId: string,
  data: StrategyInput
) {
  const strategy = await Strategy.findOneAndUpdate(
    { _id: strategyId, userId, isArchived: false },
    withOrders(data),
    { new: true }
  );
  if (!strategy) throw notFound('Strategy');
  return strategy;
}

export async function archiveStrategy(userId: string, strategyId: string) {
  const strategy = await Strategy.findOneAndUpdate(
    { _id: strategyId, userId },
    { isArchived: true, isActive: false },
    { new: true }
  );
  if (!strategy) throw notFound('Strategy');
  return strategy;
}

export async function duplicateStrategy(userId: string, strategyId: string) {
  const source = await getStrategy(userId, strategyId);
  const copy = await Strategy.create({
    userId,
    name: `${source.name} (copy)`,
    description: source.description,
    markets: source.markets,
    timeframes: source.timeframes,
    rules: source.rules,
    categories: source.categories,
    version: 1,
    isArchived: false,
    isActive: true,
  });
  copy.rootStrategyId = copy._id as Types.ObjectId;
  await copy.save();
  return copy;
}

export async function createStrategyVersion(
  userId: string,
  strategyId: string,
  overrides: Partial<StrategyInput> = {}
) {
  const source = await getStrategy(userId, strategyId);
  const rootId = source.rootStrategyId ?? source._id;

  const latest = await Strategy.findOne({
    userId,
    $or: [{ _id: rootId }, { rootStrategyId: rootId }],
  }).sort({ version: -1 });

  const nextVersion = (latest?.version ?? source.version) + 1;

  const version = await Strategy.create({
    userId,
    name: overrides.name ?? source.name,
    description: overrides.description ?? source.description,
    markets: overrides.markets ?? source.markets,
    timeframes: overrides.timeframes ?? source.timeframes,
    rules: overrides.rules ?? source.rules,
    categories: overrides.categories ?? source.categories,
    version: nextVersion,
    parentStrategyId: source._id,
    rootStrategyId: rootId,
    isArchived: false,
    isActive: true,
  });

  return version;
}

export async function listStrategyVersions(userId: string, strategyId: string) {
  const source = await getStrategy(userId, strategyId);
  const rootId = source.rootStrategyId ?? source._id;
  return Strategy.find({
    userId,
    $or: [{ _id: rootId }, { rootStrategyId: rootId }],
  }).sort({ version: 1 });
}

export async function assertOwnedStrategy(userId: string, strategyId: string) {
  const strategy = await Strategy.findOne({ _id: strategyId, userId });
  if (!strategy) throw new AppError('Strategy not found', 404);
  return strategy;
}
