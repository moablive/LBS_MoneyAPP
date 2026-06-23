import { z } from 'zod';

export const loanStatusEnum = z.enum(['active', 'paid']);
export const loanTypeEnum = z.enum(['given', 'received', 'fgts']);

export const loanSchema = z.object({
  id: z.string().uuid(),
  loginhubId: z.number(),
  accountId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  description: z.string().min(1, 'A descrição é obrigatória'),
  amount: z.number().positive('O valor deve ser positivo'),
  date: z.string(), // ISO Date
  type: loanTypeEnum,
  status: loanStatusEnum,
  createdAt: z.string(), // ISO Date
  updatedAt: z.string(), // ISO Date
  hasReceipt: z.boolean(),
});

export type Loan = z.infer<typeof loanSchema>;

export const createLoanSchema = z.object({
  accountId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  description: z.string().min(1, 'A descrição é obrigatória'),
  amount: z.number().positive('O valor deve ser positivo'),
  date: z.string(), // ISO Date
  type: loanTypeEnum,
  status: loanStatusEnum.default('active'),
  installments: z.number().int().min(1).default(1).optional(),
  receipt: z.object({
    mimeType: z.string(),
    base64: z.string(),
  }).optional(),
});

export type CreateLoanInput = z.infer<typeof createLoanSchema>;

export const updateLoanSchema = createLoanSchema.partial();

export type UpdateLoanInput = z.infer<typeof updateLoanSchema>;

export const loanItemSchema = loanSchema;

export type LoanItem = z.infer<typeof loanItemSchema>;

export const loanSummaryResponseSchema = z.object({
  activeCount: z.number().int(),
  paidCount: z.number().int(),
  totalAmountGiven: z.number(),
  totalAmountReceived: z.number(),
  totalAmountFGTS: z.number(),
  totalActiveAmountGiven: z.number(),
  totalActiveAmountReceived: z.number(),
  totalActiveAmountFGTS: z.number(),
  items: z.array(loanItemSchema),
});

export type LoanSummaryResponse = z.infer<typeof loanSummaryResponseSchema>;
