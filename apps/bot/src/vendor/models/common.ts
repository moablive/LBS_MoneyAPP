import { z } from 'zod';

export const uuidSchema = z.string().uuid();

export const transactionTypeEnum = z.enum(['expense', 'income']);
export type TransactionType = z.infer<typeof transactionTypeEnum>;

export const categoryTypeEnum = z.enum(['expense', 'income']);
export type CategoryType = z.infer<typeof categoryTypeEnum>;

export const periodPresetEnum = z.enum([
  'current_month',
  'previous_month',
  'last_3_months',
  'year_to_date',
  'custom',
]);
export type PeriodPreset = z.infer<typeof periodPresetEnum>;

export const monthStringSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/u, 'Expected YYYY-MM');

export const investmentTypeEnum = z.enum([
  'stock',
  'crypto',
  'fixed_income',
  'fund',
  'other',
]);
export type InvestmentType = z.infer<typeof investmentTypeEnum>;
