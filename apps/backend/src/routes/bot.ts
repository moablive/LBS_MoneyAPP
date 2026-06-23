import { Router } from 'express';
import { and, desc, eq, isNull, isNotNull, sql } from 'drizzle-orm';
import { db, schema } from '@moneyapp/db';
import argon2 from 'argon2';

import { requireBotKey } from '../middleware/auth.js';
import { ensureDefaultCategories } from '@moneyapp/services';

const { users, transactions, categories, accounts, loans } = schema;

export const botRouter = Router();

// Service-to-service guard: the bot presents BOT_SERVICE_KEY (x-api-key).
// End-user credentials are validated by the bot against LoginHub directly.
botRouter.use(requireBotKey);

// 1. Obter usuário pelo Telegram ID
botRouter.get('/users/by-telegram/:telegramId', async (req, res, next) => {
  try {
    const { telegramId } = req.params;
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.telegramId, telegramId))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json({ id: user.id });
  } catch (err) {
    next(err);
  }
});

// 1.5. Obter todos os usuários com telegramId configurado
botRouter.get('/users/all', async (_req, res, next) => {
  try {
    const rows = await db
      .select({ id: users.id, email: users.email, telegramId: users.telegramId })
      .from(users)
      .where(isNotNull(users.telegramId));

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// 2. Vincular o Telegram a um usuário já autenticado no LoginHub.
//    O bot valida e-mail+senha NO LOGINHUB antes de chamar aqui; este endpoint
//    apenas grava o telegram_id (casando por e-mail) e provisiona a linha local
//    + categorias padrão se for o primeiro acesso do usuário ao MoneyAPP.
botRouter.post('/link-telegram', async (req, res, next) => {
  try {
    const { email, telegramId, name } = req.body as { email?: string; telegramId?: string; name?: string };

    if (!email || !telegramId) {
      res.status(400).json({ error: 'missing_fields' });
      return;
    }

    const emailLower = email.toLowerCase().trim();

    let user = await db.query.users.findFirst({ where: eq(users.email, emailLower) });
    if (!user) {
      const displayName = name?.trim() || emailLower.split('@')[0]!;
      const [created] = await db.insert(users).values({ email: emailLower, name: displayName }).returning();
      user = created!;
      await ensureDefaultCategories(user.id);
    }

    await db.update(users).set({ telegramId, updatedAt: new Date() }).where(eq(users.id, user.id));

    res.json({ id: user.id });
  } catch (err) {
    next(err);
  }
});

// 3. Resumo por categoria (Gráfico de Pizza)
botRouter.get('/summaries/by-category', async (req, res, next) => {
  try {
    const userId = req.query.userId as string;
    const type = req.query.type as 'income' | 'expense';

    if (!userId || !type) {
      res.status(400).json({ error: 'missing_fields' });
      return;
    }

    const rows = await db
      .select({
        name: categories.name,
        color: categories.color,
        total: sql<string>`abs(sum(${transactions.amount}))`,
      })
      .from(transactions)
      .innerJoin(categories, eq(transactions.categoryId, categories.id))
      .where(and(eq(transactions.userId, userId), eq(transactions.type, type)))
      .groupBy(categories.name, categories.color);

    res.json(rows.map((r) => ({ name: r.name, color: r.color, total: Number(r.total) })));
  } catch (err) {
    next(err);
  }
});

// 4. Todas as transações da categoria
botRouter.get('/categories/:categoryId/transactions', async (req, res, next) => {
  try {
    const userId = req.query.userId as string;
    const { categoryId } = req.params;

    if (!userId || !categoryId) {
      res.status(400).json({ error: 'missing_fields' });
      return;
    }

    const currentMonth = sql`date_trunc('month', ${transactions.occurredAt}) = date_trunc('month', now())`;

    const [totalRow] = await db
      .select({ total: sql<string | null>`abs(sum(${transactions.amount}))` })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.categoryId, categoryId),
          currentMonth,
        ),
      );
    const total = totalRow?.total ? Number(totalRow.total) : 0;

    const txs = await db
      .select({
        description: transactions.description,
        amount: sql<string>`abs(${transactions.amount})`,
        occurredAt: transactions.occurredAt,
      })
      .from(transactions)
      .where(and(eq(transactions.userId, userId), eq(transactions.categoryId, categoryId)))
      .orderBy(desc(transactions.occurredAt))
      .limit(5);

    res.json({
      total,
      transactions: txs.map((t) => ({
        description: t.description,
        amount: Number(t.amount),
        occurredAt: t.occurredAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// 5. Todos os resumos (Receitas e Despesas do mês)
botRouter.get('/summaries/all', async (req, res, next) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) {
      res.status(400).json({ error: 'missing_userId' });
      return;
    }

    const currentMonth = sql`date_trunc('month', ${transactions.occurredAt}) = date_trunc('month', now())`;

    const rows = await db
      .select({
        name: categories.name,
        type: categories.type,
        total: sql<string>`abs(sum(${transactions.amount}))`,
      })
      .from(transactions)
      .innerJoin(categories, eq(transactions.categoryId, categories.id))
      .where(and(eq(transactions.userId, userId), currentMonth))
      .groupBy(categories.name, categories.type)
      .orderBy(desc(categories.type), desc(sql`abs(sum(${transactions.amount}))`));

    res.json(rows.map((r) => ({ name: r.name, type: r.type, total: Number(r.total) })));
  } catch (err) {
    next(err);
  }
});

// 6. Transações recentes sem recibo
botRouter.get('/transactions/no-receipt', async (req, res, next) => {
  try {
    const userId = req.query.userId as string;
    const limitCount = req.query.limit ? Number(req.query.limit) : 5;

    if (!userId) {
      res.status(400).json({ error: 'missing_userId' });
      return;
    }

    const rows = await db
      .select({
        id: transactions.id,
        description: transactions.description,
        amount: transactions.amount,
        occurredAt: transactions.occurredAt,
      })
      .from(transactions)
      .innerJoin(categories, eq(transactions.categoryId, categories.id))
      .where(
        and(
          eq(transactions.userId, userId),
          isNull(transactions.receiptBase64),
          sql`${categories.name} ILIKE '%controle%'`
        )
      )
      .orderBy(desc(transactions.occurredAt))
      .limit(limitCount);

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// 7. Dashboard summary (saldo atual)
botRouter.get('/dashboard/summary', async (req, res, next) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) {
      res.status(400).json({ error: 'missing_userId' });
      return;
    }

    const [balanceRow] = await db
      .select({ total: sql<string | null>`sum(${accounts.currentBalance})` })
      .from(accounts)
      .where(
        and(
          eq(accounts.userId, userId),
          eq(accounts.freezeBalance, false),
          sql`${accounts.type} != 'credit_card'`
        )
      );

    res.json({
      currentBalance: balanceRow?.total ? Number(balanceRow.total) : 0,
    });
  } catch (err) {
    next(err);
  }
});

// 7.5. Resumo de contas (Saldos)
botRouter.get('/dashboard/accounts', async (req, res, next) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) {
      res.status(400).json({ error: 'missing_userId' });
      return;
    }

    const rows = await db
      .select({
        name: accounts.name,
        currentBalance: accounts.currentBalance,
      })
      .from(accounts)
      .where(
        and(
          eq(accounts.userId, userId),
          sql`${accounts.type} != 'credit_card'`
        )
      )
      .orderBy(desc(accounts.currentBalance));

    res.json(rows.map(r => ({
      name: r.name,
      currentBalance: Number(r.currentBalance),
    })));
  } catch (err) {
    next(err);
  }
});

// 8. Resumo de cartões de crédito
botRouter.get('/dashboard/cards', async (req, res, next) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) {
      res.status(400).json({ error: 'missing_userId' });
      return;
    }

    const cards = await db
      .select({
        name: accounts.name,
        currentBalance: accounts.currentBalance,
        creditLimit: accounts.creditLimit,
      })
      .from(accounts)
      .where(
        and(
          eq(accounts.userId, userId),
          eq(accounts.type, 'credit_card')
        )
      );

    res.json(cards.map(c => ({
      name: c.name,
      currentBalance: Number(c.currentBalance),
      creditLimit: c.creditLimit ? Number(c.creditLimit) : null,
    })));
  } catch (err) {
    next(err);
  }
});

// 9. Criar link de compartilhamento
botRouter.post('/shares', async (req, res, next) => {
  try {
    const { userId, categoryId } = req.body;
    if (!userId) {
      res.status(400).json({ error: 'missing_userId' });
      return;
    }

    const crypto = await import('node:crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const password = crypto.randomBytes(6).toString('hex'); // 12 chars
    const passwordHash = await argon2.hash(password);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const { sharedLinks } = schema;
    const [row] = await db
      .insert(sharedLinks)
      .values({
        userId,
        categoryId: categoryId || null,
        token,
        passwordHash,
        expiresAt,
      })
      .returning();

    res.json({ token: row!.token, password });
  } catch (err) {
    next(err);
  }
});
// 10. Resumo de Empréstimos
botRouter.get('/loans/summary', async (req, res, next) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) {
      res.status(400).json({ error: 'missing_userId' });
      return;
    }

    const rows = await db
      .select({
        id: loans.id,
        amount: loans.amount,
        type: loans.type,
        status: loans.status,
        date: loans.date,
        description: loans.description,
      })
      .from(loans)
      .where(eq(loans.userId, userId))
      .orderBy(desc(loans.date));

    const activeItems = rows.filter((i) => i.status === 'active').map(i => ({
      ...i,
      amount: Number(i.amount),
      date: i.date.toISOString(),
    }));

    const totalActiveAmountGiven = activeItems.filter((i) => i.type === 'given').reduce((acc, i) => acc + i.amount, 0);
    const totalActiveAmountReceived = activeItems.filter((i) => i.type === 'received').reduce((acc, i) => acc + i.amount, 0);
    const totalActiveAmountFGTS = activeItems.filter((i) => i.type === 'fgts').reduce((acc, i) => acc + i.amount, 0);

    res.json({
      totalActiveAmountGiven,
      totalActiveAmountReceived,
      totalActiveAmountFGTS,
      items: activeItems,
    });
  } catch (err) {
    next(err);
  }
});
