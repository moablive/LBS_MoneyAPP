import { z } from 'zod';
import { categoryTypeEnum, monthStringSchema } from './common';

export const categoryRankingQuerySchema = z
  .object({
    month: monthStringSchema.optional(),
    type: categoryTypeEnum.default('expense'),
    includeZero: z.coerce.boolean().default(false),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  })
  .strict();
export type CategoryRankingQuery = z.infer<typeof categoryRankingQuerySchema>;

export const categoryRankingItemSchema = z.object({
  categoryId: z.string().uuid(),
  name: z.string(),
  color: z.string().nullable(),
  current: z.number(),
  previous: z.number(),
  share: z.number(),                   // % of `totalCurrent`
  variationPct: z.number().nullable(), // null when previous period was zero (no baseline)
});
export type CategoryRankingItem = z.infer<typeof categoryRankingItemSchema>;

export const categoryRankingResponseSchema = z.object({
  month: monthStringSchema,
  type: categoryTypeEnum,
  totalCurrent: z.number(),
  totalPrevious: z.number(),
  ranking: z.array(categoryRankingItemSchema),
});
export type CategoryRankingResponse = z.infer<typeof categoryRankingResponseSchema>;

// ---------- summary (KPI cards on the dashboard) ----------------------------
export const dashboardSummaryQuerySchema = z
  .object({ month: monthStringSchema.optional() })
  .strict();
export type DashboardSummaryQuery = z.infer<typeof dashboardSummaryQuerySchema>;

export const dashboardSummaryResponseSchema = z.object({
  month: monthStringSchema,
  openingBalance: z.number(), // saldo no início do mês (sum of accounts as of monthStart)
  income: z.number(),
  expense: z.number(),        // absolute value
  savingsPct: z.number(),     // (income - expense) / income * 100; null-safe -> 0
  closingBalance: z.number(),
});
export type DashboardSummaryResponse = z.infer<typeof dashboardSummaryResponseSchema>;

// ---------- cumulative spending evolution line chart -------------------------
export const spendingEvolutionQuerySchema = z
  .object({ month: monthStringSchema.optional() })
  .strict();
export type SpendingEvolutionQuery = z.infer<typeof spendingEvolutionQuerySchema>;

export const spendingEvolutionPointSchema = z.object({
  day: z.number().int().min(1).max(31),
  current: z.number(),
  previous: z.number(),
});
export const spendingEvolutionResponseSchema = z.object({
  month: monthStringSchema,
  totalCurrent: z.number(),
  totalPrevious: z.number(),
  series: z.array(spendingEvolutionPointSchema),
});
export type SpendingEvolutionResponse = z.infer<typeof spendingEvolutionResponseSchema>;

// ---------- recurring services summary --------------------------------------
export const recurringItemSchema = z.object({
  description: z.string(),
  monthly: z.number(),
  lastSeen: z.string(),                   // ISO date
  categoryId: z.string().uuid().nullable(),
  accountId: z.string().uuid().nullable(),
  type: z.enum(['expense', 'income']),
  isActive: z.boolean(),                  // seen in last 35 days
});
export type RecurringItem = z.infer<typeof recurringItemSchema>;

export const recurringSummaryResponseSchema = z.object({
  activeCount: z.number().int(),
  totalCount: z.number().int(),
  gastoMensal: z.number(),
  projecaoAnual: z.number(),
  mediaServico: z.number(),
  items: z.array(recurringItemSchema),
});
export type RecurringSummaryResponse = z.infer<typeof recurringSummaryResponseSchema>;
