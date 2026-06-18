import { z } from 'zod';
import { transactionTypeEnum } from './common';

export const subscriptionStatusEnum = z.enum(['active', 'inactive']);

export const subscriptionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  description: z.string().min(1, 'A descrição é obrigatória'),
  amount: z.number().positive('O valor deve ser positivo'),
  type: transactionTypeEnum,
  categoryId: z.string().uuid(),
  accountId: z.string().uuid().nullable(),
  status: subscriptionStatusEnum,
  billingDay: z.number().int().min(1).max(31).nullable().optional(),
  createdAt: z.string(), // ISO date
  updatedAt: z.string(), // ISO date
});

export type Subscription = z.infer<typeof subscriptionSchema>;

export const createSubscriptionSchema = z.object({
  description: z.string().min(1, 'A descrição é obrigatória'),
  amount: z.number().positive('O valor deve ser positivo'),
  type: transactionTypeEnum,
  categoryId: z.string().uuid(),
  accountId: z.string().uuid().nullable().optional(),
  status: subscriptionStatusEnum.default('active'),
  billingDay: z.number().int().min(1).max(31).nullable().optional(),
});

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;

export const updateSubscriptionSchema = createSubscriptionSchema.partial();

export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;

export const subscriptionItemSchema = subscriptionSchema.extend({
  categoryName: z.string().nullable().optional(),
  categoryColor: z.string().nullable().optional(),
  accountName: z.string().nullable().optional(),
  bankCode: z.string().nullable().optional(),
  customIconUrl: z.string().nullable().optional(),
});

export type SubscriptionItem = z.infer<typeof subscriptionItemSchema>;

export const subscriptionSummaryResponseSchema = z.object({
  activeCount: z.number().int(),
  totalCount: z.number().int(),
  gastoMensal: z.number(),
  projecaoAnual: z.number(),
  gastoTerceiros: z.number(),
  mediaServico: z.number(),
  items: z.array(subscriptionItemSchema),
});

export type SubscriptionSummaryResponse = z.infer<typeof subscriptionSummaryResponseSchema>;
