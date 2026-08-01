import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const accountSchema = z.object({
  name: z.string().min(1).max(80),
  type: z.enum(['live', 'demo', 'prop']).default('demo'),
  currency: z.string().default('USD'),
  startingBalance: z.number().min(0).default(0),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
});

const checklistItemSchema = z.object({
  _id: z.string().optional(),
  label: z.string().min(1),
  description: z.string().optional(),
  order: z.number().int().min(0).default(0),
  isRequired: z.boolean().default(false),
});

const checklistCategorySchema = z.object({
  _id: z.string().optional(),
  name: z.string().min(1),
  order: z.number().int().min(0).default(0),
  items: z.array(checklistItemSchema).default([]),
});

export const strategySchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().optional(),
  markets: z.array(z.string()).default([]),
  timeframes: z.array(z.string()).default([]),
  rules: z
    .object({
      riskRules: z.array(z.string()).default([]),
      tpRules: z.array(z.string()).default([]),
      breakEvenRules: z.array(z.string()).default([]),
    })
    .default({ riskRules: [], tpRules: [], breakEvenRules: [] }),
  categories: z.array(checklistCategorySchema).default([]),
  isActive: z.boolean().optional(),
});

export const createVersionSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().optional(),
  markets: z.array(z.string()).optional(),
  timeframes: z.array(z.string()).optional(),
  rules: z
    .object({
      riskRules: z.array(z.string()).default([]),
      tpRules: z.array(z.string()).default([]),
      breakEvenRules: z.array(z.string()).default([]),
    })
    .optional(),
  categories: z.array(checklistCategorySchema).optional(),
});

const checklistResponseSchema = z.object({
  categoryId: z.string(),
  categoryName: z.string(),
  itemId: z.string(),
  itemLabel: z.string(),
  checked: z.boolean(),
});

export const tradeSchema = z.object({
  accountId: z.string().min(1),
  strategyId: z.string().optional(),
  date: z.coerce.date(),
  symbol: z.string().min(1).max(30),
  direction: z.enum(['long', 'short']),
  entry: z.number().nullish(),
  exit: z.number().nullish(),
  stopLoss: z.number().nullish(),
  takeProfit: z.number().nullish(),
  risk: z.number().positive(),
  contracts: z.number().positive().default(1),
  resultUsd: z.number(),
  resultR: z.number(),
  maximumRr: z.number().positive().nullish(),
  maxBeforeRetest: z.number().positive().nullish(),
  commission: z.number().min(0).default(0),
  session: z.enum(['asia', 'london', 'newyork', 'overlap', 'other']).default('other'),
  screenshots: z.array(z.string()).default([]),
  notes: z.string().optional(),
  checklist: z.array(checklistResponseSchema).default([]),
  psychologyTags: z
    .array(
      z.enum([
        'fomo',
        'revenge',
        'early_exit',
        'late_entry',
        'oversized_risk',
        'rule_violation',
        'moving_stop',
      ])
    )
    .default([]),
});

export const journalEntryBaseSchema = z.object({
  source: z.enum(['taken', 'not_taken']),
  date: z.coerce.date(),
  accountId: z.string().optional(),
  strategyId: z.string().optional(),
  symbol: z.string().min(1).max(30).optional(),
  direction: z.enum(['long', 'short']).optional(),
  entry: z.number().nullish(),
  exit: z.number().nullish(),
  stopLoss: z.number().nullish(),
  takeProfit: z.number().nullish(),
  risk: z.number().positive().optional(),
  contracts: z.number().positive().optional(),
  resultUsd: z.number().optional(),
  resultR: z.number().optional(),
  maximumRr: z.number().positive().nullish(),
  maxBeforeRetest: z.number().positive().nullish(),
  commission: z.number().min(0).optional(),
  session: z.enum(['asia', 'london', 'newyork', 'overlap', 'other']).optional(),
  screenshots: z.array(z.string()).optional(),
  notes: z.string().optional(),
  checklist: z.array(checklistResponseSchema).optional(),
  psychologyTags: z
    .array(
      z.enum([
        'fomo',
        'revenge',
        'early_exit',
        'late_entry',
        'oversized_risk',
        'rule_violation',
        'moving_stop',
      ])
    )
    .optional(),
  valid: z.boolean().optional(),
  outcome: z.enum(['win', 'loss', 'be']).optional(),
});

export const journalEntrySchema = journalEntryBaseSchema.superRefine((data, ctx) => {
  if (data.source !== 'taken' && data.source !== 'not_taken') return;

  if (!data.symbol) {
    ctx.addIssue({ code: 'custom', message: 'symbol required', path: ['symbol'] });
  }
  if (!data.direction) {
    ctx.addIssue({ code: 'custom', message: 'direction required', path: ['direction'] });
  }
  if (data.resultR == null) {
    ctx.addIssue({
      code: 'custom',
      message: 'resultR required (0 = breakeven)',
      path: ['resultR'],
    });
  }
});

export const journalEntryUpdateSchema = journalEntryBaseSchema.partial();

export const dayReviewSchema = z.object({
  date: z.coerce.date(),
  marketNotes: z.string().optional(),
  emotionalState: z.string().optional(),
  grade: z.enum(['A', 'B', 'C', 'D', 'F']).optional(),
  setups: z
    .array(
      z.object({
        time: z.string().min(1),
        strategyId: z.string().optional(),
        strategyName: z.string().optional(),
        valid: z.boolean().default(true),
        taken: z.boolean().default(false),
        result: z.enum(['win', 'loss', 'be']),
        maximumRr: z.number().optional(),
        screenshot: z.string().optional(),
        notes: z.string().optional(),
        checklist: z.array(checklistResponseSchema).default([]),
      })
    )
    .default([]),
});

export const coachChatSchema = z.object({
  message: z.string().trim().min(1, 'Message is required').max(2000),
  source: z.enum(['taken', 'not_taken', 'combined']).default('combined'),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().min(1).max(8000),
      })
    )
    .max(20)
    .default([]),
});
