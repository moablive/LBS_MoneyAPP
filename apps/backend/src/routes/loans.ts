import { Router } from 'express';
import { eq, desc, and, sql } from 'drizzle-orm';
import { db, schema } from '@moneyapp/shared/db';
const { loans } = schema;
import { requireAuth, validate } from '@moneyapp/shared/server';
import { createLoanSchema, updateLoanSchema, type LoanSummaryResponse } from '@moneyapp/shared';

export const loansRouter = Router();

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
      const data = req.body as import('@moneyapp/shared').CreateLoanInput;
      const installmentsCount = data.installments ?? 1;

      if (installmentsCount > 1) {
        const perInstallmentAmount = data.amount / installmentsCount;
        const recordsToInsert = [];

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
            receiptBase64: data.receipt?.base64 ?? null,
            receiptMimeType: data.receipt?.mimeType ?? null,
          });
        }

        const newLoans = await db.insert(loans).values(recordsToInsert).returning();

        res.status(201).json({
          message: `${installmentsCount} parcelas criadas com sucesso`,
          createdCount: newLoans.length,
        });
      } else {
        const [newLoan] = await db
          .insert(loans)
          .values({
            ...data,
            userId,
            accountId: data.accountId ?? null,
            amount: data.amount.toString(),
            date: new Date(data.date),
            receiptBase64: data.receipt?.base64 ?? null,
            receiptMimeType: data.receipt?.mimeType ?? null,
          })
          .returning();

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
      const data = req.body as import('@moneyapp/shared').UpdateLoanInput;

      const updateData: any = { ...data };
      if (data.accountId !== undefined) updateData.accountId = data.accountId;
      if (data.amount !== undefined) updateData.amount = data.amount.toString();
      if (data.date !== undefined) updateData.date = new Date(data.date);
      if (data.receipt !== undefined) {
        updateData.receiptBase64 = data.receipt?.base64 ?? null;
        updateData.receiptMimeType = data.receipt?.mimeType ?? null;
      }
      updateData.updatedAt = new Date();

      const [updated] = await db
        .update(loans)
        .set(updateData)
        .where(and(eq(loans.id, id), eq(loans.userId, userId)))
        .returning();

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
