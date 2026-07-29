import { asyncHandler, sendSuccess } from '../utils/api';
import { param } from '../utils/params';
import * as tradeService from '../services/trade.service';

export const list = asyncHandler(async (req, res) => {
  const result = await tradeService.listTrades(req.user!.id, {
    accountId: req.query.accountId as string | undefined,
    strategyId: req.query.strategyId as string | undefined,
    symbol: req.query.symbol as string | undefined,
    from: req.query.from ? new Date(String(req.query.from)) : undefined,
    to: req.query.to ? new Date(String(req.query.to)) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    page: req.query.page ? Number(req.query.page) : undefined,
  });
  sendSuccess(res, result);
});

export const getOne = asyncHandler(async (req, res) => {
  const trade = await tradeService.getTrade(req.user!.id, param(req.params.id));
  sendSuccess(res, trade);
});

export const create = asyncHandler(async (req, res) => {
  const trade = await tradeService.createTrade(req.user!.id, req.body);
  sendSuccess(res, trade, 201);
});

export const update = asyncHandler(async (req, res) => {
  const trade = await tradeService.updateTrade(
    req.user!.id,
    param(req.params.id),
    req.body
  );
  sendSuccess(res, trade);
});

export const remove = asyncHandler(async (req, res) => {
  await tradeService.deleteTrade(req.user!.id, param(req.params.id));
  sendSuccess(res, null, 200, 'Trade deleted');
});
