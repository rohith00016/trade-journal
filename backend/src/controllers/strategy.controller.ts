import { asyncHandler, sendSuccess } from '../utils/api';
import { param } from '../utils/params';
import * as strategyService from '../services/strategy.service';

export const list = asyncHandler(async (req, res) => {
  const includeArchived = req.query.includeArchived === 'true';
  const strategies = await strategyService.listStrategies(req.user!.id, {
    includeArchived,
  });
  sendSuccess(res, strategies);
});

export const getOne = asyncHandler(async (req, res) => {
  const strategy = await strategyService.getStrategy(
    req.user!.id,
    param(req.params.id)
  );
  sendSuccess(res, strategy);
});

export const create = asyncHandler(async (req, res) => {
  const strategy = await strategyService.createStrategy(req.user!.id, req.body);
  sendSuccess(res, strategy, 201);
});

export const update = asyncHandler(async (req, res) => {
  const strategy = await strategyService.updateStrategy(
    req.user!.id,
    param(req.params.id),
    req.body
  );
  sendSuccess(res, strategy);
});

export const archive = asyncHandler(async (req, res) => {
  const strategy = await strategyService.archiveStrategy(
    req.user!.id,
    param(req.params.id)
  );
  sendSuccess(res, strategy, 200, 'Strategy archived');
});

export const duplicate = asyncHandler(async (req, res) => {
  const strategy = await strategyService.duplicateStrategy(
    req.user!.id,
    param(req.params.id)
  );
  sendSuccess(res, strategy, 201);
});

export const createVersion = asyncHandler(async (req, res) => {
  const strategy = await strategyService.createStrategyVersion(
    req.user!.id,
    param(req.params.id),
    req.body
  );
  sendSuccess(res, strategy, 201);
});

export const versions = asyncHandler(async (req, res) => {
  const list = await strategyService.listStrategyVersions(
    req.user!.id,
    param(req.params.id)
  );
  sendSuccess(res, list);
});
