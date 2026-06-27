import { Router } from 'express';
import { eq, desc, and, sql } from 'drizzle-orm';
import { db, schema } from '@moneyapp/db';
const { loans, transactions, accounts, categories } = schema;
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createLoanSchema, updateLoanSchema, type LoanSummaryResponse } from '@moneyapp/models';

export const loansRouter = Router();

// ---------- helpers ----------------------------------------------------------
function applyBalanceDelta(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  loginhubId: number,
  accountId: string,
  delta: string | number,
) {
  return tx
    .update(accounts)
    .set({
      currentBalance: sql`${accounts.currentBalance} + ${String(delta)}::numeric`,
    })
    .where(and(eq(accounts.id, accountId), eq(accounts.loginhubId, loginhubId), eq(accounts.freezeBalance, false)));
}

function negate(value: string): string {
  if (value.startsWith('-')) return value.slice(1);
  return `-${value}`;
}

async function ensureCategory(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  loginhubId: number,
  type: 'expense' | 'income'
) {
  const existing = await tx.query.categories.findFirst({
    where: and(eq(categories.loginhubId, loginhubId), eq(categories.type, type), eq(categories.name, 'Empréstimos')),
  });
  if (existing) return existing.id;
  const [created] = await tx.insert(categories).values({
    loginhubId,
    name: 'Empréstimos',
    type,
    color: '#3b82f6',
  }).returning();
  return created!.id;
}

loansRouter.get('/summary', requireAuth, async (req, res, next) => {
  try {
    const loginhubId = req.user!.loginhubId;

    const rows = await db
      .select({
        id: loans.id,
        loginhubId: loans.loginhubId,
        description: loans.description,
        amount: loans.amount,
        expectedAmount: loans.expectedAmount,
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
      .where(eq(loans.loginhubId, loginhubId))
      .orderBy(desc(loans.date));

    const items = rows.map((r) => ({
      id: r.id,
      loginhubId: r.loginhubId,
      description: r.description,
      amount: Number(r.amount),
      expectedAmount: r.expectedAmount ? Number(r.expectedAmount) : undefined,
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
    
    // Total amounts for all items
    const totalAmountGiven = items.filter((i) => i.type === 'given').reduce((acc, i) => acc + (i.expectedAmount ?? i.amount), 0);
    const totalAmountReceived = items.filter((i) => i.type === 'received').reduce((acc, i) => acc + (i.expectedAmount ?? i.amount), 0);
    const totalAmountFGTS = items.filter((i) => i.type === 'fgts').reduce((acc, i) => acc + (i.expectedAmount ?? i.amount), 0);

    // Total amounts for active items
    const totalActiveAmountGiven = activeItems.filter((i) => i.type === 'given').reduce((acc, i) => acc + (i.expectedAmount ?? i.amount), 0);
    const totalActiveAmountReceived = activeItems.filter((i) => i.type === 'received').reduce((acc, i) => acc + (i.expectedAmount ?? i.amount), 0);
    const totalActiveAmountFGTS = activeItems.filter((i) => i.type === 'fgts').reduce((acc, i) => acc + (i.expectedAmount ?? i.amount), 0);

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
      const loginhubId = req.user!.loginhubId;
      const data = req.body as import('@moneyapp/models').CreateLoanInput;
      const installmentsCount = data.installments ?? 1;

      if (installmentsCount > 1) {
        // ... (For simplicity, assume installments don't have expectedAmount logic or just divide both)
        const perInstallmentAmount = data.amount / installmentsCount;
        const perInstallmentExpected = data.expectedAmount ? data.expectedAmount / installmentsCount : perInstallmentAmount;
        
        const recordsToInsert: any[] = [];

        for (let i = 1; i <= installmentsCount; i++) {
          const installmentDate = new Date(data.date);
          installmentDate.setUTCMonth(installmentDate.getUTCMonth() + (i - 1));
          
          recordsToInsert.push({
            loginhubId,
            description: `${data.description} (${i}/${installmentsCount})`,
            amount: perInstallmentAmount.toString(),
            expectedAmount: perInstallmentExpected.toString(),
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
          
          for (const l of created) {
            // INITIAL TRANSACTION
            if (l.accountId) {
              const initTxType = l.type === 'received' ? 'income' : 'expense';
              const initSignedAmount = initTxType === 'expense' ? `-${l.amount}` : l.amount;
              const catId = await ensureCategory(tx, loginhubId, initTxType);
              await tx.insert(transactions).values({
                loginhubId,
                loanId: l.id,
                description: `Empréstimo (Saída): ${l.description}`,
                amount: initSignedAmount,
                type: initTxType,
                status: 'paid',
                occurredAt: l.date,
                categoryId: catId,
                accountId: l.accountId,
              });
              await applyBalanceDelta(tx, loginhubId, l.accountId, initSignedAmount);
            }

            // SETTLEMENT TRANSACTION
            if (l.status === 'paid' && l.categoryId) {
              const txType = l.type === 'received' ? 'expense' : 'income';
              const expectedStr = l.expectedAmount ?? l.amount;
              const signedAmount = txType === 'expense' ? `-${expectedStr}` : expectedStr;
              await tx.insert(transactions).values({
                loginhubId,
                loanId: l.id,
                description: `Empréstimo (Quitação): ${l.description}`,
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
                await applyBalanceDelta(tx, loginhubId, l.accountId, signedAmount);
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
              loginhubId,
              accountId: data.accountId ?? null,
              categoryId: data.categoryId ?? null,
              amount: data.amount.toString(),
              expectedAmount: data.expectedAmount ? data.expectedAmount.toString() : data.amount.toString(),
              date: new Date(data.date),
              receiptBase64: data.receipt?.base64 ?? null,
              receiptMimeType: data.receipt?.mimeType ?? null,
            })
            .returning();

          // INITIAL TRANSACTION
          if (created && created.accountId) {
            const initTxType = created.type === 'received' ? 'income' : 'expense';
            const initSignedAmount = initTxType === 'expense' ? `-${created.amount}` : created.amount;
            const catId = await ensureCategory(tx, loginhubId, initTxType);
            await tx.insert(transactions).values({
              loginhubId,
              loanId: created.id,
              description: `Empréstimo (Saída): ${created.description}`,
              amount: initSignedAmount,
              type: initTxType,
              status: 'paid',
              occurredAt: created.date,
              categoryId: catId,
              accountId: created.accountId,
            });
            await applyBalanceDelta(tx, loginhubId, created.accountId, initSignedAmount);
          }

          // SETTLEMENT TRANSACTION
          if (created && created.status === 'paid' && created.categoryId) {
            const txType = created.type === 'received' ? 'expense' : 'income';
            const expectedStr = created.expectedAmount ?? created.amount;
            const signedAmount = txType === 'expense' ? `-${expectedStr}` : expectedStr;
            await tx.insert(transactions).values({
              loginhubId,
              loanId: created.id,
              description: `Empréstimo (Quitação): ${created.description}`,
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
              await applyBalanceDelta(tx, loginhubId, created.accountId, signedAmount);
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
          expectedAmount: newLoan.expectedAmount ? Number(newLoan.expectedAmount) : undefined,
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
      const loginhubId = req.user!.loginhubId;
      const id = req.params.id as string;
      const data = req.body as import('@moneyapp/models').UpdateLoanInput;

      const updateData: any = { ...data };
      if (data.accountId !== undefined) updateData.accountId = data.accountId;
      if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
      if (data.amount !== undefined) updateData.amount = data.amount.toString();
      if (data.expectedAmount !== undefined) updateData.expectedAmount = data.expectedAmount?.toString();
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
          .where(and(eq(loans.id, id), eq(loans.loginhubId, loginhubId)))
          .returning();

        if (!updatedLoan) return null;

        const allTxs = await tx.query.transactions.findMany({
          where: and(eq(transactions.loanId, updatedLoan.id)),
        });

        const initTxType = updatedLoan.type === 'received' ? 'income' : 'expense';
        const settlementTxType = updatedLoan.type === 'received' ? 'expense' : 'income';

        const initialTx = allTxs.find(t => t.type === initTxType);
        const settlementTx = allTxs.find(t => t.type === settlementTxType);

        // 1. UPDATE OR DELETE INITIAL TX
        if (updatedLoan.accountId) {
          const initSignedAmount = initTxType === 'expense' ? `-${updatedLoan.amount}` : updatedLoan.amount;
          if (initialTx) {
            // Revert old, apply new
            if (initialTx.accountId) {
              await applyBalanceDelta(tx, loginhubId, initialTx.accountId, negate(initialTx.amount));
            }
            await tx.update(transactions).set({
              amount: initSignedAmount,
              accountId: updatedLoan.accountId,
              occurredAt: updatedLoan.date,
            }).where(eq(transactions.id, initialTx.id));
            await applyBalanceDelta(tx, loginhubId, updatedLoan.accountId, initSignedAmount);
          } else {
            // Create initial if it didn't exist
            const catId = await ensureCategory(tx, loginhubId, initTxType);
            await tx.insert(transactions).values({
              loginhubId,
              loanId: updatedLoan.id,
              description: `Empréstimo (Saída): ${updatedLoan.description}`,
              amount: initSignedAmount,
              type: initTxType,
              status: 'paid',
              occurredAt: updatedLoan.date,
              categoryId: catId,
              accountId: updatedLoan.accountId,
            });
            await applyBalanceDelta(tx, loginhubId, updatedLoan.accountId, initSignedAmount);
          }
        } else if (initialTx) {
          // Account removed, delete initial tx
          if (initialTx.accountId) {
            await applyBalanceDelta(tx, loginhubId, initialTx.accountId, negate(initialTx.amount));
          }
          await tx.delete(transactions).where(eq(transactions.id, initialTx.id));
        }

        // 2. UPDATE OR CREATE SETTLEMENT TX
        if (updatedLoan.status === 'paid' && updatedLoan.categoryId) {
          const expectedStr = updatedLoan.expectedAmount ?? updatedLoan.amount;
          const signedAmount = settlementTxType === 'expense' ? `-${expectedStr}` : expectedStr;

          if (settlementTx) {
            if (settlementTx.accountId) {
              await applyBalanceDelta(tx, loginhubId, settlementTx.accountId, negate(settlementTx.amount));
            }
            await tx.update(transactions).set({
              amount: signedAmount,
              occurredAt: updatedLoan.date,
              categoryId: updatedLoan.categoryId,
              accountId: updatedLoan.accountId,
              receiptBase64: updatedLoan.receiptBase64,
              receiptMimeType: updatedLoan.receiptMimeType,
            }).where(eq(transactions.id, settlementTx.id));
            if (updatedLoan.accountId) {
              await applyBalanceDelta(tx, loginhubId, updatedLoan.accountId, signedAmount);
            }
          } else {
            await tx.insert(transactions).values({
              loginhubId,
              loanId: updatedLoan.id,
              description: `Empréstimo (Quitação): ${updatedLoan.description}`,
              amount: signedAmount,
              type: settlementTxType,
              status: 'paid',
              occurredAt: updatedLoan.date,
              categoryId: updatedLoan.categoryId,
              accountId: updatedLoan.accountId,
              receiptBase64: updatedLoan.receiptBase64,
              receiptMimeType: updatedLoan.receiptMimeType,
            });
            if (updatedLoan.accountId) {
              await applyBalanceDelta(tx, loginhubId, updatedLoan.accountId, signedAmount);
            }
          }
        } else if (settlementTx) {
          if (settlementTx.accountId) {
            await applyBalanceDelta(tx, loginhubId, settlementTx.accountId, negate(settlementTx.amount));
          }
          await tx.delete(transactions).where(eq(transactions.id, settlementTx.id));
        }

        return updatedLoan;
      });

      if (!updated) {
        return res.status(404).json({ message: 'Loan not found' });
      }

      res.json({
        ...updated,
        amount: Number(updated.amount),
        expectedAmount: updated.expectedAmount ? Number(updated.expectedAmount) : undefined,
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
    const loginhubId = req.user!.loginhubId;
    const id = req.params.id as string;

    const [deleted] = await db
      .delete(loans)
      .where(and(eq(loans.id, id), eq(loans.loginhubId, loginhubId)))
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
    const loginhubId = req.user!.loginhubId;
    const id = req.params.id as string;
    const [row] = await db
      .select({ receiptBase64: loans.receiptBase64, receiptMimeType: loans.receiptMimeType })
      .from(loans)
      .where(and(eq(loans.id, id), eq(loans.loginhubId, loginhubId)));
      
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
