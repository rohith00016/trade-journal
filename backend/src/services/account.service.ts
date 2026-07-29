import { Account } from '../models';
import { AppError } from '../types';
import { notFound } from '../utils/api';

export async function listAccounts(userId: string) {
  return Account.find({ userId }).sort({ createdAt: -1 });
}

export async function createAccount(
  userId: string,
  data: {
    name: string;
    type?: 'live' | 'demo' | 'prop';
    currency?: string;
    startingBalance?: number;
    notes?: string;
  }
) {
  return Account.create({ ...data, userId });
}

export async function updateAccount(
  userId: string,
  accountId: string,
  data: Partial<{
    name: string;
    type: 'live' | 'demo' | 'prop';
    currency: string;
    startingBalance: number;
    notes: string;
    isActive: boolean;
  }>
) {
  const account = await Account.findOneAndUpdate(
    { _id: accountId, userId },
    data,
    { new: true }
  );
  if (!account) throw notFound('Account');
  return account;
}

export async function deleteAccount(userId: string, accountId: string) {
  const account = await Account.findOneAndDelete({ _id: accountId, userId });
  if (!account) throw notFound('Account');
  return account;
}

export async function getOwnedAccount(userId: string, accountId: string) {
  const account = await Account.findOne({ _id: accountId, userId });
  if (!account) throw new AppError('Account not found', 404);
  return account;
}
