import { Router } from 'express';
import { and, asc, eq } from 'drizzle-orm';
import { createAccountSchema, updateAccountSchema } from '@moneyapp/models';
import { db, schema } from '@moneyapp/db';
const { accounts } = schema;
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

export const accountsRouter = Router();
accountsRouter.use(requireAuth);

accountsRouter.get('/', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const rows = await db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, userId))
      .orderBy(asc(accounts.name));
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

accountsRouter.post('/', validate(createAccountSchema), async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const body = req.body as import('@moneyapp/models').CreateAccountInput;
    const [row] = await db
      .insert(accounts)
      .values({
        userId,
        name: body.name,
        type: body.type,
        bankCode: body.bankCode ?? null,
        customIconUrl: body.customIconUrl ?? null,
        currentBalance: body.currentBalance.toFixed(2),
      })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

accountsRouter.patch('/:id', validate(updateAccountSchema), async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const id = req.params.id!;
    const body = req.body as import('@moneyapp/models').UpdateAccountInput;
    const patch: Record<string, unknown> = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.type !== undefined) patch.type = body.type;
    if (body.bankCode !== undefined) patch.bankCode = body.bankCode;
    if (body.customIconUrl !== undefined) patch.customIconUrl = body.customIconUrl;
    if (body.currentBalance !== undefined) patch.currentBalance = body.currentBalance.toFixed(2);
    const [row] = await db
      .update(accounts)
      .set(patch)
      .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
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

accountsRouter.delete('/:id', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const id = req.params.id!;
    const result = await db
      .delete(accounts)
      .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
      .returning({ id: accounts.id });
    if (result.length === 0) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
