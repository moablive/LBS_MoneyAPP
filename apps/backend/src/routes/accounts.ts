import { Router } from 'express';
import { and, asc, eq } from 'drizzle-orm';
import { createAccountSchema, updateAccountSchema, payInvoiceSchema } from '@moneyapp/models';
import { db, schema } from '@moneyapp/db';
const { accounts, transactions } = schema;
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { applyBalanceDelta } from './transactions.js';

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
        freezeBalance: body.freezeBalance ?? false,
        creditLimit: body.creditLimit ? body.creditLimit.toFixed(2) : null,
        closingDay: body.closingDay ? String(body.closingDay) : null,
        dueDay: body.dueDay ? String(body.dueDay) : null,
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
    if (body.freezeBalance !== undefined) patch.freezeBalance = body.freezeBalance;
    if (body.creditLimit !== undefined) patch.creditLimit = body.creditLimit ? body.creditLimit.toFixed(2) : null;
    if (body.closingDay !== undefined) patch.closingDay = body.closingDay ? String(body.closingDay) : null;
    if (body.dueDay !== undefined) patch.dueDay = body.dueDay ? String(body.dueDay) : null;
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

// ---------- pay-invoice ------------------------------------------------------
accountsRouter.post('/:id/pay-invoice', validate(payInvoiceSchema), async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const creditCardId = req.params.id!;
    const body = req.body as import('@moneyapp/models').PayInvoiceInput;

    const result = await db.transaction(async (tx) => {
      // 1. Transaction on the credit card (Income to reduce debt)
      const [ccTx] = await tx
        .insert(transactions)
        .values({
          userId,
          description: body.description,
          amount: body.amount.toFixed(2), // income is positive
          type: 'income',
          status: 'paid',
          occurredAt: new Date(body.date),
          categoryId: body.categoryId,
          accountId: creditCardId,
        })
        .returning();

      // Math.abs the delta as handled by credit cards, but here it's an income so it's already positive.
      await applyBalanceDelta(tx, userId, creditCardId, ccTx!.amount);

      let sourceTx = null;
      // 2. If source account exists, transaction on source account (Expense)
      if (body.sourceAccountId && body.sourceAccountId !== creditCardId) {
        [sourceTx] = await tx
          .insert(transactions)
          .values({
            userId,
            description: body.description,
            amount: (-Math.abs(body.amount)).toFixed(2), // expense is negative
            type: 'expense',
            status: 'paid',
            occurredAt: new Date(body.date),
            categoryId: body.categoryId,
            accountId: body.sourceAccountId,
          })
          .returning();

        await applyBalanceDelta(tx, userId, body.sourceAccountId, sourceTx!.amount);
      }

      return { ccTx, sourceTx };
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});
