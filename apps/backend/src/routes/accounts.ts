import { Router } from 'express';
import { and, asc, eq } from 'drizzle-orm';
import {
  createAccountSchema,
  updateAccountSchema,
  payInvoiceSchema,
  linkInvoicePaymentSchema,
} from '@moneyapp/models';
import { db, schema } from '@moneyapp/db';
const { accounts, transactions } = schema;
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { applyBalanceDelta, isFaturaPaymentTx, HttpError } from './transactions.js';

export const accountsRouter = Router();
accountsRouter.use(requireAuth);

accountsRouter.get('/', async (req, res, next) => {
  try {
    const loginhubId = req.user!.loginhubId;
    const rows = await db
      .select()
      .from(accounts)
      .where(eq(accounts.loginhubId, loginhubId))
      .orderBy(asc(accounts.name));
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

accountsRouter.post('/', validate(createAccountSchema), async (req, res, next) => {
  try {
    const loginhubId = req.user!.loginhubId;
    const body = req.body as import('@moneyapp/models').CreateAccountInput;
    const [row] = await db
      .insert(accounts)
      .values({
        loginhubId,
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
    const loginhubId = req.user!.loginhubId;
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
      .where(and(eq(accounts.id, id), eq(accounts.loginhubId, loginhubId)))
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
    const loginhubId = req.user!.loginhubId;
    const id = req.params.id!;
    const result = await db
      .delete(accounts)
      .where(and(eq(accounts.id, id), eq(accounts.loginhubId, loginhubId)))
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
    const loginhubId = req.user!.loginhubId;
    const creditCardId = req.params.id!;
    const body = req.body as import('@moneyapp/models').PayInvoiceInput;

    const result = await db.transaction(async (tx) => {
      // 1. Transaction on the credit card (Income to reduce debt)
      const [ccTx] = await tx
        .insert(transactions)
        .values({
          loginhubId,
          description: body.description,
          amount: body.amount.toFixed(2), // income is positive
          type: 'income',
          status: 'paid',
          occurredAt: new Date(body.date),
          categoryId: body.categoryId,
          accountId: creditCardId,
          receiptBase64: (!body.sourceAccountId || body.sourceAccountId === creditCardId) ? (body.receipt?.base64 ?? null) : null,
          receiptMimeType: (!body.sourceAccountId || body.sourceAccountId === creditCardId) ? (body.receipt?.mimeType ?? null) : null,
        })
        .returning();

      // Math.abs the delta as handled by credit cards, but here it's an income so it's already positive.
      await applyBalanceDelta(tx, loginhubId, creditCardId, ccTx!.amount);

      let sourceTx = null;
      // 2. If source account exists, transaction on source account (Expense)
      if (body.sourceAccountId && body.sourceAccountId !== creditCardId) {
        [sourceTx] = await tx
          .insert(transactions)
          .values({
            loginhubId,
            description: body.description,
            amount: (-Math.abs(body.amount)).toFixed(2), // expense is negative
            type: 'expense',
            status: 'paid',
            occurredAt: new Date(body.date),
            categoryId: body.categoryId,
            accountId: body.sourceAccountId,
            receiptBase64: body.receipt?.base64 ?? null,
            receiptMimeType: body.receipt?.mimeType ?? null,
          })
          .returning();

        await applyBalanceDelta(tx, loginhubId, body.sourceAccountId, sourceTx!.amount);
      }

      return { ccTx, sourceTx };
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// ---------- link-invoice-payment ---------------------------------------------
// Same outcome as `pay-invoice`, except the money-out side already exists in the
// cash book: the user points at that transaction instead of typing a new one.
accountsRouter.post('/:id/link-invoice-payment', validate(linkInvoicePaymentSchema), async (req, res, next) => {
  try {
    const loginhubId = req.user!.loginhubId;
    const creditCardId = req.params.id!;
    const body = req.body as import('@moneyapp/models').LinkInvoicePaymentInput;

    const result = await db.transaction(async (tx) => {
      const card = await tx.query.accounts.findFirst({
        where: and(eq(accounts.id, creditCardId), eq(accounts.loginhubId, loginhubId)),
      });
      if (!card) throw new HttpError(404, 'card_not_found');
      if (card.type !== 'credit_card') throw new HttpError(422, 'account_is_not_a_credit_card');

      const source = await tx.query.transactions.findFirst({
        where: and(eq(transactions.id, body.transactionId), eq(transactions.loginhubId, loginhubId)),
      });
      if (!source) throw new HttpError(404, 'transaction_not_found');
      if (source.invoiceCardId) throw new HttpError(409, 'transaction_already_linked');
      if (source.subscriptionId) throw new HttpError(409, 'transaction_linked_to_subscription');
      if (source.type !== 'expense') throw new HttpError(422, 'transaction_must_be_an_expense');
      // An expense already sitting on the card is a purchase (or a FATURA entry
      // that settled the invoice on its own) — linking it would double count.
      if (source.accountId === creditCardId) throw new HttpError(422, 'transaction_belongs_to_the_card');

      // 1. Flag the existing entry and settle it when it was still pending.
      const [linked] = await tx
        .update(transactions)
        .set({ invoiceCardId: creditCardId, status: 'paid', updatedAt: new Date() })
        .where(and(eq(transactions.id, source.id), eq(transactions.loginhubId, loginhubId)))
        .returning({ id: transactions.id, invoiceCardId: transactions.invoiceCardId });

      if (source.status === 'pending' && source.accountId) {
        const sourceIsFatura = await isFaturaPaymentTx(tx, source.accountId, source.categoryId);
        const delta = sourceIsFatura ? Math.abs(Number(source.amount)) : Number(source.amount);
        await applyBalanceDelta(tx, loginhubId, source.accountId, delta);
      }

      // 2. Counterpart on the credit card (income) so the debt drops and the
      //    payment stays visible in the card's statement, exactly as pay-invoice.
      const [ccTx] = await tx
        .insert(transactions)
        .values({
          loginhubId,
          // Keeps the origin readable in the statement without looking like a
          // duplicate of the user's own line. `description` is varchar(255).
          description: `Pagamento de Fatura · ${source.description}`.slice(0, 255),
          amount: Math.abs(Number(source.amount)).toFixed(2), // income is positive
          type: 'income',
          status: 'paid',
          occurredAt: source.occurredAt,
          categoryId: source.categoryId,
          accountId: creditCardId,
          invoiceCardId: creditCardId,
        })
        .returning({ id: transactions.id, amount: transactions.amount });

      await applyBalanceDelta(tx, loginhubId, creditCardId, ccTx!.amount);

      return { linked, ccTx };
    });

    res.status(201).json(result);
  } catch (err) {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.code });
      return;
    }
    next(err);
  }
});
