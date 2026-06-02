import { Router } from 'express';
import { eq, desc, and, sql } from 'drizzle-orm';
import { db, schema } from '@moneyapp/db';
const { loans, transactions, accounts } = schema;
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createLoanSchema, updateLoanSchema, type LoanSummaryResponse } from '@moneyapp/models';

export const loansRouter = Router();

// ---------- helpers ----------------------------------------------------------
function applyBalanceDelta(
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
  if (value.startsWith('-')) return value.slice(1);
  return `-${value}`;
}

loansRouter.get('/summary', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;

    const rows = await db
      .select({
        id: loans.id,
        userId: loans.userId,
        description: loans.description,
        amount: loans.amount,
        date: loans.date,
        type: loans.type,
        status: loans.status,
        accountId: loans.accountId,
        categoryId: loans.categoryId,
        createdAt: loans.createdAt,
        updatedAt: loans.updatedAt,
        hasReceipt: sql<boolean>`${loans.receiptBase64} is not null`.as('has_receipt'),
      })
      .from(loans)
      .where(eq(loans.userId, userId))
      .orderBy(desc(loans.date));

    const items = rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      description: r.description,
      amount: Number(r.amount),
      date: r.date.toISOString(),
      type: r.type,
      status: r.status,
      accountId: r.accountId,
      categoryId: r.categoryId,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      hasReceipt: r.hasReceipt,
    }));

    const activeItems = items.filter((i) => i.status === 'active');
    const paidItems = items.filter((i) => i.status === 'paid');
    
    const totalAmountGiven = items.filter((i) => i.type === 'given').reduce((acc, i) => acc + i.amount, 0);
    const totalAmountReceived = items.filter((i) => i.type === 'received').reduce((acc, i) => acc + i.amount, 0);
    const totalAmountFGTS = items.filter((i) => i.type === 'fgts').reduce((acc, i) => acc + i.amount, 0);

    const totalActiveAmountGiven = activeItems.filter((i) => i.type === 'given').reduce((acc, i) => acc + i.amount, 0);
    const totalActiveAmountReceived = activeItems.filter((i) => i.type === 'received').reduce((acc, i) => acc + i.amount, 0);
    const totalActiveAmountFGTS = activeItems.filter((i) => i.type === 'fgts').reduce((acc, i) => acc + i.amount, 0);

    const body: LoanSummaryResponse = {
      activeCount: activeItems.length,
      paidCount: paidItems.length,
      totalAmountGiven,
      totalAmountReceived,
      totalAmountFGTS,
      totalActiveAmountGiven,
      totalActiveAmountReceived,
      totalActiveAmountFGTS,
      items,
    };

    res.json(body);
  } catch (error) {
    next(error);
  }
});

loansRouter.post(
  '/',
  requireAuth,
  validate(createLoanSchema, 'body'),
  async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const data = req.body as import('@moneyapp/models').CreateLoanInput;
      const installmentsCount = data.installments ?? 1;

      if (installmentsCount > 1) {
        const perInstallmentAmount = data.amount / installmentsCount;
        const recordsToInsert: any[] = [];

        for (let i = 1; i <= installmentsCount; i++) {
          const installmentDate = new Date(data.date);
          installmentDate.setUTCMonth(installmentDate.getUTCMonth() + (i - 1));
          
          recordsToInsert.push({
            userId,
            description: `${data.description} (${i}/${installmentsCount})`,
            amount: perInstallmentAmount.toString(),
            date: installmentDate,
            type: data.type,
            status: data.status,
            accountId: data.accountId ?? null,
            categoryId: data.categoryId ?? null,
            receiptBase64: data.receipt?.base64 ?? null,
            receiptMimeType: data.receipt?.mimeType ?? null,
          });
        }

        const newLoans = await db.transaction(async (tx) => {
          const created = await tx.insert(loans).values(recordsToInsert).returning();
          
          // sync transactions for any that are created as 'paid'
          for (const l of created) {
            if (l.status === 'paid' && l.categoryId) {
              const txType = l.type === 'received' ? 'expense' : 'income';
              const signedAmount = txType === 'expense' ? `-${l.amount}` : l.amount;
              await tx.insert(transactions).values({
                userId,
                loanId: l.id,
                description: l.description,
                amount: signedAmount,
                type: txType,
                status: 'paid',
                occurredAt: l.date,
                categoryId: l.categoryId,
                accountId: l.accountId,
                receiptBase64: l.receiptBase64,
                receiptMimeType: l.receiptMimeType,
              });
              if (l.accountId) {
                await applyBalanceDelta(tx, userId, l.accountId, signedAmount);
              }
            }
          }
          return created;
        });

        res.status(201).json({
          message: `${installmentsCount} parcelas criadas com sucesso`,
          createdCount: newLoans.length,
        });
      } else {
        const newLoan = await db.transaction(async (tx) => {
          const [created] = await tx
            .insert(loans)
            .values({
              ...data,
              userId,
              accountId: data.accountId ?? null,
              categoryId: data.categoryId ?? null,
              amount: data.amount.toString(),
              date: new Date(data.date),
              receiptBase64: data.receipt?.base64 ?? null,
              receiptMimeType: data.receipt?.mimeType ?? null,
            })
            .returning();

          if (created && created.status === 'paid' && created.categoryId) {
            const txType = created.type === 'received' ? 'expense' : 'income';
            const signedAmount = txType === 'expense' ? `-${created.amount}` : created.amount;
            await tx.insert(transactions).values({
              userId,
              loanId: created.id,
              description: created.description,
              amount: signedAmount,
              type: txType,
              status: 'paid',
              occurredAt: created.date,
              categoryId: created.categoryId,
              accountId: created.accountId,
              receiptBase64: created.receiptBase64,
              receiptMimeType: created.receiptMimeType,
            });
            if (created.accountId) {
              await applyBalanceDelta(tx, userId, created.accountId, signedAmount);
            }
          }

          return created;
        });

        if (!newLoan) {
          return res.status(500).json({ error: 'Failed to create loan' });
        }

        res.status(201).json({
          ...newLoan,
          amount: Number(newLoan.amount),
          date: newLoan.date.toISOString(),
          createdAt: newLoan.createdAt.toISOString(),
          updatedAt: newLoan.updatedAt.toISOString(),
        });
      }
    } catch (error) {
      next(error);
    }
  }
);

loansRouter.put(
  '/:id',
  requireAuth,
  validate(updateLoanSchema, 'body'),
  async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const id = req.params.id as string;
      const data = req.body as import('@moneyapp/models').UpdateLoanInput;

      const updateData: any = { ...data };
      if (data.accountId !== undefined) updateData.accountId = data.accountId;
      if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
      if (data.amount !== undefined) updateData.amount = data.amount.toString();
      if (data.date !== undefined) updateData.date = new Date(data.date);
      if (data.receipt !== undefined) {
        updateData.receiptBase64 = data.receipt?.base64 ?? null;
        updateData.receiptMimeType = data.receipt?.mimeType ?? null;
      }
      updateData.updatedAt = new Date();

      const updated = await db.transaction(async (tx) => {
        const [updatedLoan] = await tx
          .update(loans)
          .set(updateData)
          .where(and(eq(loans.id, id), eq(loans.userId, userId)))
          .returning();

        if (!updatedLoan) return null;

        const existingTx = await tx.query.transactions.findFirst({
          where: and(eq(transactions.loanId, updatedLoan.id)),
        });

        if (updatedLoan.status === 'paid' && updatedLoan.categoryId) {
          const txType = updatedLoan.type === 'received' ? 'expense' : 'income';
          const signedAmount = txType === 'expense' ? `-${updatedLoan.amount}` : updatedLoan.amount;

          if (existingTx) {
            // Revert old balance
            if (existingTx.accountId) {
              await applyBalanceDelta(tx, userId, existingTx.accountId, negate(existingTx.amount));
            }
            // Update transaction
            await tx.update(transactions).set({
              amount: signedAmount,
              type: txType,
              occurredAt: updatedLoan.date,
              categoryId: updatedLoan.categoryId,
              accountId: updatedLoan.accountId,
              receiptBase64: updatedLoan.receiptBase64,
              receiptMimeType: updatedLoan.receiptMimeType,
            }).where(eq(transactions.id, existingTx.id));
            // Apply new balance
            if (updatedLoan.accountId) {
              await applyBalanceDelta(tx, userId, updatedLoan.accountId, signedAmount);
            }
          } else {
            await tx.insert(transactions).values({
              userId,
              loanId: updatedLoan.id,
              description: updatedLoan.description,
              amount: signedAmount,
              type: txType,
              status: 'paid',
              occurredAt: updatedLoan.date,
              categoryId: updatedLoan.categoryId,
              accountId: updatedLoan.accountId,
              receiptBase64: updatedLoan.receiptBase64,
              receiptMimeType: updatedLoan.receiptMimeType,
            });
            if (updatedLoan.accountId) {
              await applyBalanceDelta(tx, userId, updatedLoan.accountId, signedAmount);
            }
          }
        } else if (existingTx) {
          // If it was changed to active, or category removed, delete the tx and revert balance
          if (existingTx.accountId) {
            await applyBalanceDelta(tx, userId, existingTx.accountId, negate(existingTx.amount));
          }
          await tx.delete(transactions).where(eq(transactions.id, existingTx.id));
        }

        return updatedLoan;
      });

      if (!updated) {
        return res.status(404).json({ message: 'Loan not found' });
      }

      res.json({
        ...updated,
        amount: Number(updated.amount),
        date: updated.date.toISOString(),
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      });
    } catch (error) {
      next(error);
    }
  }
);

loansRouter.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const id = req.params.id as string;

    const [deleted] = await db
      .delete(loans)
      .where(and(eq(loans.id, id), eq(loans.userId, userId)))
      .returning();

    if (!deleted) {
      return res.status(404).json({ message: 'Loan not found' });
    }

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

loansRouter.get('/:id/receipt', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const id = req.params.id as string;
    const [row] = await db
      .select({ receiptBase64: loans.receiptBase64, receiptMimeType: loans.receiptMimeType })
      .from(loans)
      .where(and(eq(loans.id, id), eq(loans.userId, userId)));
      
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
