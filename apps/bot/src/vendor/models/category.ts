import { z } from 'zod';
import { categoryTypeEnum } from './common';

export const createCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    type: categoryTypeEnum,
    color: z
      .string()
      .regex(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/u, 'Expected #RRGGBB or #RRGGBBAA')
      .optional(),
  })
  .strict();
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = createCategorySchema.partial();
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export interface Category {
  id: string;
  name: string;
  type: import('./common').CategoryType;
  color: string | null;
  createdAt?: string;
}
