import { Router } from 'express';
import { eq, desc, and } from 'drizzle-orm';
import { db, schema } from '@moneyapp/db';
const { subscriptions, accounts, categories } = schema;
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createSubscriptionSchema, updateSubscriptionSchema, type SubscriptionSummaryResponse } from '@moneyapp/models';

export const subscriptionsRouter = Router();

subscriptionsRouter.get('/summary', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;

    const rows = await db
      .select({
        id: subscriptions.id,
        userId: subscriptions.userId,
        description: subscriptions.description,
        amount: subscriptions.amount,
        type: subscriptions.type,
        categoryId: subscriptions.categoryId,
        accountId: subscriptions.accountId,
        status: subscriptions.status,
        billingDay: subscriptions.billingDay,
        createdAt: subscriptions.createdAt,
        updatedAt: subscriptions.updatedAt,
        categoryName: categories.name,
        categoryColor: categories.color,
        accountName: accounts.name,
        bankCode: accounts.bankCode,
        customIconUrl: accounts.customIconUrl,
      })
      .from(subscriptions)
      .leftJoin(categories, eq(subscriptions.categoryId, categories.id))
      .leftJoin(accounts, eq(subscriptions.accountId, accounts.id))
      .where(eq(subscriptions.userId, userId))
      .orderBy(desc(subscriptions.createdAt));

    const items = rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      description: r.description,
      amount: Number(r.amount),
      type: r.type,
      categoryId: r.categoryId,
      accountId: r.accountId,
      status: r.status,
      billingDay: r.billingDay ? Number(r.billingDay) : null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      categoryName: r.categoryName,
      categoryColor: r.categoryColor,
      accountName: r.accountName,
      bankCode: r.bankCode,
      customIconUrl: r.customIconUrl,
    }));

    const activeItems = items.filter((i) => i.status === 'active');
    
    // Calcula o gasto mensal total considerando apenas 'expense' e status 'active' para as suas contas
    const gastoMensal = activeItems
      .filter((i) => i.type === 'expense' && i.accountId !== null)
      .reduce((acc, i) => acc + i.amount, 0);

    const gastoTerceiros = activeItems
      .filter((i) => i.type === 'expense' && i.accountId === null)
      .reduce((acc, i) => acc + i.amount, 0);

    const body: SubscriptionSummaryResponse = {
      activeCount: activeItems.length,
      totalCount: items.length,
      gastoMensal,
      projecaoAnual: gastoMensal * 12,
      gastoTerceiros,
      mediaServico: activeItems.length > 0 ? gastoMensal / activeItems.length : 0,
      items,
    };

    res.json(body);
  } catch (error) {
    next(error);
  }
});

subscriptionsRouter.post(
  '/',
  requireAuth,
  validate(createSubscriptionSchema, 'body'),
  async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const data = req.body as import('@moneyapp/models').CreateSubscriptionInput;

      const [newSub] = await db
        .insert(subscriptions)
        .values({
          ...data,
          userId,
          amount: data.amount.toString(),
          billingDay: data.billingDay?.toString(),
        })
        .returning();

      if (!newSub) {
        return res.status(500).json({ error: 'Failed to create subscription' });
      }

      res.status(201).json({
        ...newSub,
        amount: Number(newSub.amount),
        billingDay: newSub.billingDay ? Number(newSub.billingDay) : null,
      });
    } catch (error) {
      next(error);
    }
  }
);

subscriptionsRouter.put(
  '/:id',
  requireAuth,
  validate(updateSubscriptionSchema, 'body'),
  async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const id = req.params.id as string;
      const data = req.body as import('@moneyapp/models').UpdateSubscriptionInput;

      const updateData: any = { ...data };
      if (data.amount !== undefined) updateData.amount = data.amount.toString();
      if (data.billingDay !== undefined) updateData.billingDay = data.billingDay?.toString();

      const [updated] = await db
        .update(subscriptions)
        .set(updateData)
        .where(and(eq(subscriptions.id, id), eq(subscriptions.userId, userId)))
        .returning();

      if (!updated) {
        return res.status(404).json({ message: 'Subscription not found' });
      }

      res.json({
        ...updated,
        amount: Number(updated.amount),
        billingDay: updated.billingDay ? Number(updated.billingDay) : null,
      });
    } catch (error) {
      next(error);
    }
  }
);

subscriptionsRouter.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const id = req.params.id as string;

    const [deleted] = await db
      .delete(subscriptions)
      .where(and(eq(subscriptions.id, id), eq(subscriptions.userId, userId)))
      .returning();

    if (!deleted) {
      return res.status(404).json({ message: 'Subscription not found' });
    }

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});
