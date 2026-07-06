import { Router } from 'express';
import { db, schema } from '@moneyapp/db';
import { and, eq, gte, lte } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';

export const calendarRouter = Router();

calendarRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const loginhubId = req.user!.loginhubId;
    const startStr = req.query.start as string;
    const endStr = req.query.end as string;

    if (!startStr || !endStr) {
      return res.status(400).json({ error: 'Missing start or end query parameters' });
    }

    const startDate = new Date(startStr);
    const endDate = new Date(endStr);

    const txs = await db.query.transactions.findMany({
      where: and(
        eq(schema.transactions.loginhubId, loginhubId),
        gte(schema.transactions.occurredAt, startDate),
        lte(schema.transactions.occurredAt, endDate)
      ),
      with: {
        category: true,
      }
    });

    const loans = await db.query.loans.findMany({
      where: and(
        eq(schema.loans.loginhubId, loginhubId),
        gte(schema.loans.date, startDate),
        lte(schema.loans.date, endDate)
      ),
    });

    const items: any[] = [];

    txs.forEach((tx) => {
      items.push({
        id: `tx-${tx.id}`,
        title: tx.description,
        date: tx.occurredAt.toISOString(),
        amount: Number(tx.amount),
        type: tx.type,
        status: tx.status,
        category: tx.category?.name,
        color: tx.type === 'expense' ? '#ef4444' : '#22c55e',
      });
    });

    loans.forEach((loan) => {
      items.push({
        id: `loan-${loan.id}`,
        title: loan.description,
        date: loan.date.toISOString(),
        amount: Number(loan.expectedAmount || loan.amount),
        type: loan.type === 'given' ? 'expense' : 'income', 
        status: loan.status,
        category: 'Empréstimos',
        color: loan.type === 'given' ? '#3b82f6' : '#eab308',
      });
    });

    res.json(items);
  } catch (error) {
    next(error);
  }
});
