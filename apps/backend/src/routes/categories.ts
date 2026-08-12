import { Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { categoryTypeEnum, createCategorySchema, updateCategorySchema } from '@moneyapp/models';
import { db, schema } from '@moneyapp/db';
const { categories } = schema;
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

export const categoriesRouter = Router();
categoriesRouter.use(requireAuth);

const listQuerySchema = z
  .object({ type: categoryTypeEnum.optional() })
  .strict();

categoriesRouter.get('/', validate(listQuerySchema, 'query'), async (req, res, next) => {
  try {
    const loginhubId = req.user!.loginhubId;
    const { type } = req.query as z.infer<typeof listQuerySchema>;
    const rows = await db
      .select()
      .from(categories)
      .where(
        type
          ? and(eq(categories.loginhubId, loginhubId), eq(categories.type, type))
          : eq(categories.loginhubId, loginhubId),
      )
      .orderBy(desc(categories.createdAt));
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

categoriesRouter.post('/', validate(createCategorySchema), async (req, res, next) => {
  try {
    const loginhubId = req.user!.loginhubId;
    const body = req.body as import('@moneyapp/models').CreateCategoryInput;
    const [row] = await db
      .insert(categories)
      .values({ ...body, loginhubId })
      .returning();
    res.status(201).json(row);
  } catch (err: unknown) {
    // Unique-violation (categories_user_name_type_uq)
    if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === '23505') {
      res.status(409).json({ error: 'duplicate_category' });
      return;
    }
    next(err);
  }
});

categoriesRouter.patch('/:id', validate(updateCategorySchema), async (req, res, next) => {
  try {
    const loginhubId = req.user!.loginhubId;
    const id = req.params.id!;
    const body = req.body as import('@moneyapp/models').UpdateCategoryInput;
    const [row] = await db
      .update(categories)
      .set(body)
      .where(and(eq(categories.id, id), eq(categories.loginhubId, loginhubId)))
      .returning();
    if (!row) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json(row);
  } catch (err) {
    next(err);
  }
});

categoriesRouter.delete('/:id', async (req, res, next) => {
  try {
    const loginhubId = req.user!.loginhubId;
    const id = req.params.id!;
    const result = await db
      .delete(categories)
      .where(and(eq(categories.id, id), eq(categories.loginhubId, loginhubId)))
      .returning({ id: categories.id });
    if (result.length === 0) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.status(204).end();
  } catch (err: unknown) {
    // FK violation — category still has transactions attached.
    if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === '23503') {
      res.status(409).json({ error: 'category_in_use' });
      return;
    }
    next(err);
  }
});
