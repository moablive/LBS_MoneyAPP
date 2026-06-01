import { z } from 'zod';

export const accountTypeEnum = z.enum([
  'checking',
  'savings',
  'credit_card',
  'wallet',
  'investment',
  'other',
]);
export type AccountType = z.infer<typeof accountTypeEnum>;

export const createAccountSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    type: accountTypeEnum,
    bankCode: z.string().trim().min(1).max(32).nullish(),
    customIconUrl: z.string().trim().max(500_000).nullish(),
    currentBalance: z.number().finite().default(0),
    creditLimit: z.number().finite().nullish(),
    closingDay: z.number().int().min(1).max(31).nullish(),
    dueDay: z.number().int().min(1).max(31).nullish(),
  })
  .strict();
export type CreateAccountInput = z.infer<typeof createAccountSchema>;

export const updateAccountSchema = createAccountSchema.partial();
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  bankCode: string | null;
  customIconUrl: string | null;
  currentBalance: string;
  creditLimit?: string | null;
  closingDay?: string | null;
  dueDay?: string | null;
  createdAt?: string;
}
