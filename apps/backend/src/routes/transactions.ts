import { Router } from 'express';
import { and, asc, desc, eq, gte, ilike, lt, sql } from 'drizzle-orm';
import { createTransactionSchema, transactionFiltersSchema, updateTransactionSchema } from '@moneyapp/models';
import { db, schema } from '@moneyapp/db';
const { accounts, transactions, categories } = schema;
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

export const transactionsRouter = Router();
transactionsRouter.use(requireAuth);

// ---------- list -------------------------------------------------------------
transactionsRouter.get('/', validate(transactionFiltersSchema, 'query'), async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const f = req.query as unknown as import('@moneyapp/models').TransactionFilters;

    const monthRange = f.month ? monthBounds(f.month) : null;
    const from = f.from ?? monthRange?.start;
    const to = f.to ?? monthRange?.end;

    const conds = [eq(transactions.userId, userId)];
    if (from) conds.push(gte(transactions.occurredAt, from));
    if (to) conds.push(lt(transactions.occurredAt, to));
    if (f.type) conds.push(eq(transactions.type, f.type));
    if (f.status) conds.push(eq(transactions.status, f.status));
    if (f.accountId) conds.push(eq(transactions.accountId, f.accountId));
    if (f.categoryId) conds.push(eq(transactions.categoryId, f.categoryId));
    if (f.search) conds.push(ilike(transactions.description, `%${f.search}%`));

    const order = (() => {
      switch (f.sort) {
        case 'date_asc':
          return [asc(transactions.occurredAt)];
        case 'amount_desc':
          return [desc(transactions.amount)];
        case 'amount_asc':
          return [asc(transactions.amount)];
        default:
          return [desc(transactions.occurredAt), desc(transactions.createdAt)];
      }
    })();

    const rows = await db
      .select({
        id: transactions.id,
        description: transactions.description,
        amount: transactions.amount,
        type: transactions.type,
        status: transactions.status,
        occurredAt: transactions.occurredAt,
        categoryId: transactions.categoryId,
        accountId: transactions.accountId,
        hasReceipt: sql<boolean>`${transactions.receiptBase64} is not null`.as('has_receipt'),
        createdAt: transactions.createdAt,
      })
      .from(transactions)
      .where(and(...conds))
      .orderBy(...order)
      .limit(f.limit);

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// ---------- create -----------------------------------------------------------
transactionsRouter.post('/', validate(createTransactionSchema), async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const body = req.body as import('@moneyapp/models').CreateTransactionInput;

    const created = await db.transaction(async (tx) => {
      const isFatura = await isFaturaPaymentTx(tx, body.accountId ?? null, body.categoryId);
      const status = body.status ?? 'paid';

      if (isFatura && status === 'paid' && (!body.receipt || !body.receipt.base64)) {
        throw new HttpError(400, 'receipt_required_for_fatura_payment');
      }

      const [row] = await tx
        .insert(transactions)
        .values({
          userId,
          description: body.description,
          amount: body.amount.toFixed(2),
          type: body.type,
          status,
          occurredAt: body.occurredAt,
          categoryId: body.categoryId,
          accountId: body.accountId ?? null,
          receiptBase64: body.receipt?.base64 ?? null,
          receiptMimeType: body.receipt?.mimeType ?? null,
        })
        .returning();

      if (row!.accountId && row!.status === 'paid') {
        let delta = Number(row!.amount);
        if (isFatura) delta = Math.abs(delta);
        await applyBalanceDelta(tx, userId, row!.accountId, delta);
      }
      return row!;
    });

    res.status(201).json(stripReceipt(created));
  } catch (err) {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.code });
      return;
    }
    next(err);
  }
});

// ---------- update -----------------------------------------------------------
transactionsRouter.patch('/:id', validate(updateTransactionSchema), async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const id = req.params.id!;
    const body = req.body as import('@moneyapp/models').UpdateTransactionInput;

    const updated = await db.transaction(async (tx) => {
      const existing = await tx.query.transactions.findFirst({
        where: and(eq(transactions.id, id), eq(transactions.userId, userId)),
      });
      if (!existing) return null;

      // If both type and amount end up set, re-validate the sign invariant
      // (the .partial() schema can't enforce it without both fields).
      const nextType = body.type ?? existing.type;
      const nextAmount = body.amount ?? Number(existing.amount);
      if (nextType === 'expense' && nextAmount >= 0) {
        throw new HttpError(422, 'amount_must_be_negative_for_expense');
      }
      if (nextType === 'income' && nextAmount <= 0) {
        throw new HttpError(422, 'amount_must_be_positive_for_income');
      }

      const patch: Record<string, unknown> = {};
      if (body.description !== undefined) patch.description = body.description;
      if (body.amount !== undefined) patch.amount = body.amount.toFixed(2);
      if (body.type !== undefined) patch.type = body.type;
      if (body.status !== undefined) patch.status = body.status;
      if (body.occurredAt !== undefined) patch.occurredAt = body.occurredAt;
      if (body.categoryId !== undefined) patch.categoryId = body.categoryId;
      if (body.accountId !== undefined) patch.accountId = body.accountId;
      if (body.receipt !== undefined) {
        patch.receiptBase64 = body.receipt?.base64 ?? null;
        patch.receiptMimeType = body.receipt?.mimeType ?? null;
      }
      patch.updatedAt = new Date();

      const [row] = await tx
        .update(transactions)
        .set(patch)
        .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
        .returning();

      const oldIsFatura = await isFaturaPaymentTx(tx, existing.accountId, existing.categoryId);
      const newIsFatura = await isFaturaPaymentTx(tx, row!.accountId, row!.categoryId);

      if (newIsFatura && row!.status === 'paid' && !row!.receiptBase64) {
        throw new HttpError(400, 'receipt_required_for_fatura_payment');
      }

      // Reverse the old delta on the old account, apply the new delta on the
      // new account.
      const oldAmountToReverse = existing.status === 'paid' ? Number(existing.amount) : 0;
      const newAmountToApply = row!.status === 'paid' ? Number(row!.amount) : 0;

      if (existing.accountId && oldAmountToReverse !== 0) {
        let deltaToReverse = oldAmountToReverse;
        if (oldIsFatura) deltaToReverse = Math.abs(deltaToReverse);
        await applyBalanceDelta(tx, userId, existing.accountId, negate(String(deltaToReverse)));
      }
      if (row!.accountId && newAmountToApply !== 0) {
        let deltaToApply = newAmountToApply;
        if (newIsFatura) deltaToApply = Math.abs(deltaToApply);
        await applyBalanceDelta(tx, userId, row!.accountId, deltaToApply);
      }
      return row!;
    });

    if (!updated) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json(stripReceipt(updated));
  } catch (err) {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.code });
      return;
    }
    next(err);
  }
});

// ---------- delete -----------------------------------------------------------
transactionsRouter.delete('/:id', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const id = req.params.id!;

    const removed = await db.transaction(async (tx) => {
      const existing = await tx.query.transactions.findFirst({
        where: and(eq(transactions.id, id), eq(transactions.userId, userId)),
      });
      if (!existing) return null;
      await tx
        .delete(transactions)
        .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
      
      const oldIsFatura = await isFaturaPaymentTx(tx, existing.accountId, existing.categoryId);
      if (existing.accountId && existing.status === 'paid') {
        let deltaToReverse = Number(existing.amount);
        if (oldIsFatura) deltaToReverse = Math.abs(deltaToReverse);
        await applyBalanceDelta(tx, userId, existing.accountId, negate(String(deltaToReverse)));
      }
      return existing;
    });

    if (!removed) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ---------- receipt streaming ------------------------------------------------
transactionsRouter.get('/:id/receipt', async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const id = req.params.id!;
    const row = await db.query.transactions.findFirst({
      where: and(eq(transactions.id, id), eq(transactions.userId, userId)),
      columns: { receiptBase64: true, receiptMimeType: true },
    });
    if (!row?.receiptBase64 || !row.receiptMimeType) {
      res.status(404).json({ error: 'no_receipt' });
      return;
    }
    const buffer = Buffer.from(row.receiptBase64, 'base64');
    res.setHeader('Content-Type', row.receiptMimeType);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('Content-Length', buffer.byteLength);
    res.end(buffer);
  } catch (err) {
    next(err);
  }
});

// ---------- helpers ----------------------------------------------------------
export function applyBalanceDelta(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: string,
  accountId: string,
  delta: string | number,
) {
  return tx
    .update(accounts)
    .set({
      currentBalance: sql`${accounts.currentBalance} + ${String(delta)}::numeric`,
    })
    // Frozen accounts keep a historical balance — skip the mutation for them.
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, userId), eq(accounts.freezeBalance, false)));
}

function negate(value: string): string {
  // amount comes back from drizzle as a string ("123.45" / "-50.00"). Just
  // flip the sign textually to avoid float round-trip.
  if (value.startsWith('-')) return value.slice(1);
  return `-${value}`;
}

function stripReceipt<T extends { receiptBase64?: string | null }>(row: T): Omit<T, 'receiptBase64'> & { hasReceipt: boolean } {
  const { receiptBase64, ...rest } = row;
  return { ...rest, hasReceipt: receiptBase64 != null };
}

class HttpError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

function monthBounds(month: string): { start: Date; end: Date } {
  const [y, m] = month.split('-').map(Number);
  const start = new Date(Date.UTC(y!, m! - 1, 1));
  const end = new Date(Date.UTC(y!, m!, 1));
  return { start, end };
}

async function isFaturaPaymentTx(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  accountId: string | null,
  categoryId: string | null
): Promise<boolean> {
  if (!accountId || !categoryId) return false;
  const acc = await tx.query.accounts.findFirst({ where: eq(accounts.id, accountId) });
  const cat = await tx.query.categories.findFirst({ where: eq(categories.id, categoryId) });
  return acc?.type === 'credit_card' && !!cat?.name.toUpperCase().includes('FATURA');
}

