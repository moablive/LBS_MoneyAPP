import { z } from 'zod';
import { transactionTypeEnum } from './common';

export const transactionStatusEnum = z.enum(['paid', 'pending']);

// Receipts are stored inline as base64. Cap at 5MB decoded to keep DB rows sane.
const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;
const BASE64_REGEX = /^[A-Za-z0-9+/]+={0,2}$/u;
const DATA_URL_PREFIX_REGEX = /^data:[\w.+-]+\/[\w.+-]+;base64,/u;

const allowedReceiptMimeTypes = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
] as const;

export const receiptSchema = z
  .object({
    mimeType: z.enum(allowedReceiptMimeTypes),
    base64: z
      .string()
      .transform((v) => v.replace(DATA_URL_PREFIX_REGEX, '').trim())
      .refine((v) => v.length > 0, 'Receipt payload is empty')
      .refine((v) => BASE64_REGEX.test(v), 'Receipt is not valid base64')
      .refine(
        // ceil(len * 3/4) is a tight upper bound on the decoded byte size and
        // avoids a full decode round-trip just to validate.
        (v) => Math.ceil((v.length * 3) / 4) <= MAX_RECEIPT_BYTES,
        `Receipt exceeds maximum ${MAX_RECEIPT_BYTES} bytes`,
      ),
  })
  .strict();
export type Receipt = z.infer<typeof receiptSchema>;

export const createTransactionSchema = z
  .object({
    description: z.string().trim().min(1).max(255),
    // amount is signed: negative = expense, positive = income (matches UI).
    amount: z
      .number()
      .finite()
      .refine((v) => v !== 0, 'Amount cannot be zero'),
    occurredAt: z.coerce.date(),
    type: transactionTypeEnum,
    status: transactionStatusEnum.default('paid'),
    categoryId: z.string().uuid(),
    accountId: z.string().uuid().nullish(),
    receipt: receiptSchema.nullable().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.type === 'expense' && data.amount >= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['amount'],
        message: 'Expense amounts must be negative',
      });
    }
    if (data.type === 'income' && data.amount <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['amount'],
        message: 'Income amounts must be positive',
      });
    }
  });
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

export const updateTransactionSchema = createTransactionSchema.innerType().partial();
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;

// Query string used by every list/aggregation endpoint that reads transactions.
export const transactionFiltersSchema = z
  .object({
    month: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/u)
      .optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    type: transactionTypeEnum.optional(),
    status: transactionStatusEnum.optional(),
    accountId: z.string().uuid().optional(),
    categoryId: z.string().uuid().optional(),
    search: z.string().trim().min(1).max(120).optional(),
    sort: z.enum(['date_desc', 'date_asc', 'amount_desc', 'amount_asc']).default('date_desc'),
    limit: z.coerce.number().int().min(1).max(200).default(50),
    cursor: z.string().optional(),
  })
  .strict();
export type TransactionFilters = z.infer<typeof transactionFiltersSchema>;

export interface Transaction {
  id: string;
  description: string;
  amount: string;
  type: import('./common').TransactionType;
  status: 'paid' | 'pending';
  occurredAt: string;
  categoryId: string;
  accountId: string | null;
  subscriptionId?: string | null;
  investmentId?: string | null;
  hasReceipt: boolean;
  createdAt?: string;
  updatedAt?: string;
}
