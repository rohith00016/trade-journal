import { asyncHandler, sendSuccess } from '../utils/api';
import { param } from '../utils/params';
import * as accountService from '../services/account.service';

export const list = asyncHandler(async (req, res) => {
  const accounts = await accountService.listAccounts(req.user!.id);
  sendSuccess(res, accounts);
});

export const create = asyncHandler(async (req, res) => {
  const account = await accountService.createAccount(req.user!.id, req.body);
  sendSuccess(res, account, 201);
});

export const update = asyncHandler(async (req, res) => {
  const account = await accountService.updateAccount(
    req.user!.id,
    param(req.params.id),
    req.body
  );
  sendSuccess(res, account);
});

export const remove = asyncHandler(async (req, res) => {
  await accountService.deleteAccount(req.user!.id, param(req.params.id));
  sendSuccess(res, null, 200, 'Account deleted');
});
