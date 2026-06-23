import { db, schema } from '@moneyapp/db';
const { investments, transactions, categories } = schema;
type Investment = typeof schema.investments.$inferSelect;
import { eq, and, asc, inArray } from 'drizzle-orm';
import { z } from 'zod';

export const investmentSchema = z.object({
  name: z.string().min(1).max(120),
  type: z.enum(['stock', 'crypto', 'fixed_income', 'fund', 'other']),
  accountId: z.string().uuid().nullable().optional(),
  quantity: z.string().or(z.number()).transform(v => String(v)),
  buyPrice: z.string().or(z.number()).transform(v => String(v)),
  currentPrice: z.string().or(z.number()).transform(v => String(v)).optional(),
  buyDate: z.string().datetime().or(z.date()).transform(v => new Date(v)),
  goalAmount: z.string().or(z.number()).transform(v => String(v)).nullable().optional(),
  yieldRate: z.string().or(z.number()).transform(v => String(v)).nullable().optional(),
  yieldIndex: z.string().max(32).nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const updateInvestmentSchema = investmentSchema.partial();

export const investmentsService = {
  async getByUserId(loginhubId: number): Promise<Investment[]> {
    const rows = await db.query.investments.findMany({
      where: eq(investments.loginhubId, loginhubId),
      with: {
        account: true,
      },
      orderBy: (inv, { desc }) => [desc(inv.buyDate)],
    });

    const fixedIncomes = rows.filter(r => r.type === 'fixed_income');
    if (fixedIncomes.length > 0) {
      const txs = await db.query.transactions.findMany({
        where: and(
          eq(transactions.loginhubId, loginhubId),
          inArray(transactions.investmentId, fixedIncomes.map(f => f.id))
        ),
      });

      const txsByInv = txs.reduce((acc, tx) => {
        if (tx.investmentId) {
          if (!acc[tx.investmentId]) acc[tx.investmentId] = [];
          acc[tx.investmentId]!.push(tx);
        }
        return acc;
      }, {} as Record<string, typeof txs[0][]>);

      for (const inv of fixedIncomes) {
        let currentDate = new Date(inv.buyDate);
        currentDate.setHours(0,0,0,0);
        const now = new Date();
        now.setHours(0,0,0,0);

        let currentBalance = 0;
        const ratePercentage = parseFloat(inv.yieldRate || '100');
        const dailyRate = (0.0004 * (ratePercentage / 100));
        const invTxs = txsByInv[inv.id] || [];

        while (currentDate <= now) {
          const dayTxs = invTxs.filter(t => new Date(t.occurredAt).toDateString() === currentDate.toDateString());
          for (const tx of dayTxs) {
            if (tx.type === 'expense') currentBalance += parseFloat(tx.amount);
            else if (tx.type === 'income') currentBalance -= parseFloat(tx.amount);
          }

          if (currentDate.getTime() === new Date(inv.buyDate).setHours(0,0,0,0) && invTxs.length === 0) {
            currentBalance = parseFloat(inv.quantity) * parseFloat(inv.buyPrice);
          }

          if (currentBalance > 0) {
            currentBalance += currentBalance * dailyRate;
          }

          currentDate.setDate(currentDate.getDate() + 1);
        }

        inv.currentPrice = currentBalance.toFixed(2);
      }
    }

    return rows;
  },

  async getSummary(loginhubId: number) {
    const allInvestments = await this.getByUserId(loginhubId);

    let totalInvested = 0;
    let currentTotal = 0;

    allInvestments.forEach(inv => {
      const quantity = parseFloat(inv.quantity);
      const buyPrice = parseFloat(inv.buyPrice);
      const currentPrice = parseFloat(inv.currentPrice || inv.buyPrice);

      totalInvested += quantity * buyPrice;
      currentTotal += quantity * currentPrice;
    });

    const profitLoss = currentTotal - totalInvested;
    const percentage = totalInvested > 0 ? (profitLoss / totalInvested) * 100 : 0;

    return {
      totalInvested,
      currentTotal,
      profitLoss,
      percentage,
      assetCount: allInvestments.length,
    };
  },

  async syncAccountBalance(loginhubId: number, accountId: string) {
    const allInvs = await this.getByUserId(loginhubId);
    const accInvs = allInvs.filter(i => i.accountId === accountId);
    
    let total = 0;
    for (const inv of accInvs) {
      const q = parseFloat(inv.quantity);
      const p = parseFloat(inv.currentPrice || inv.buyPrice);
      total += q * p;
    }
    
    await db.update(schema.accounts)
      .set({ currentBalance: total.toFixed(2) })
      .where(and(eq(schema.accounts.id, accountId), eq(schema.accounts.loginhubId, loginhubId)));
  },

  async create(loginhubId: number, data: z.infer<typeof investmentSchema>): Promise<Investment> {
    const [inserted] = await db.insert(investments).values({
      loginhubId,
      ...data,
      currentPrice: data.currentPrice || data.buyPrice,
    }).returning();
    if (!inserted) throw new Error('Failed to insert investment');
    
    if (inserted.accountId) {
      await this.syncAccountBalance(loginhubId, inserted.accountId);
    }
    
    return inserted;
  },

  async update(loginhubId: number, id: string, data: z.infer<typeof updateInvestmentSchema>): Promise<Investment | null> {
    const existing = await db.query.investments.findFirst({
      where: and(eq(investments.id, id), eq(investments.loginhubId, loginhubId))
    });
    if (!existing) return null;

    const [updated] = await db.update(investments).set({
      ...data,
      updatedAt: new Date(),
    })
    .where(and(eq(investments.id, id), eq(investments.loginhubId, loginhubId)))
    .returning();
    
    if (existing.accountId) {
      await this.syncAccountBalance(loginhubId, existing.accountId);
    }
    if (updated && updated.accountId && updated.accountId !== existing.accountId) {
      await this.syncAccountBalance(loginhubId, updated.accountId);
    }
    
    return updated || null;
  },

  async delete(loginhubId: number, id: string): Promise<boolean> {
    const existing = await db.query.investments.findFirst({
      where: and(eq(investments.id, id), eq(investments.loginhubId, loginhubId))
    });
    
    const [deleted] = await db.delete(investments)
      .where(and(eq(investments.id, id), eq(investments.loginhubId, loginhubId)))
      .returning();
      
    if (deleted && existing?.accountId) {
      await this.syncAccountBalance(loginhubId, existing.accountId);
    }
    
    return !!deleted;
  },

  async getPiggyBankChart(loginhubId: number, id: string) {
    const inv = await db.query.investments.findFirst({
      where: and(eq(investments.id, id), eq(investments.loginhubId, loginhubId))
    });
    if (!inv) throw new Error('Investment not found');

    // Get all transactions for this investment (deposits/withdrawals)
    const txs = await db.query.transactions.findMany({
      where: eq(transactions.investmentId, id),
      orderBy: [asc(transactions.occurredAt)]
    });

    // Simulate daily chart from buyDate to today
    const chart = [];
    const now = new Date();
    let currentDate = new Date(inv.buyDate);
    // Remove time component
    currentDate.setHours(0,0,0,0);
    now.setHours(0,0,0,0);

    let currentBalance = 0;
    
    // Simplistic daily yield: CDI ~10.5% a.a -> ~0.04% a.d
    const ratePercentage = parseFloat(inv.yieldRate || '100');
    const dailyRate = (0.0004 * (ratePercentage / 100)); 

    while (currentDate <= now) {
      // Add transactions of the day
      const dayTxs = txs.filter(t => new Date(t.occurredAt).toDateString() === currentDate.toDateString());
      for (const tx of dayTxs) {
        if (tx.type === 'expense') {
          currentBalance += parseFloat(tx.amount);
        } else if (tx.type === 'income') {
          currentBalance -= parseFloat(tx.amount);
        }
      }

      // If it's the very first day and no transactions, we start with the initial quantity * buyPrice
      if (currentDate.getTime() === new Date(inv.buyDate).setHours(0,0,0,0) && txs.length === 0) {
        currentBalance = parseFloat(inv.quantity) * parseFloat(inv.buyPrice);
      }

      // Apply daily yield (only on working days usually, but we simplify to every day)
      if (currentBalance > 0) {
        currentBalance += currentBalance * dailyRate;
      }

      chart.push({
        date: currentDate.toISOString(),
        value: Number(currentBalance.toFixed(2))
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return {
      chart,
      currentBalance: Number(currentBalance.toFixed(2)),
      yieldTotal: Number((currentBalance - (parseFloat(inv.quantity)*parseFloat(inv.buyPrice))).toFixed(2))
    };
  },

  async deposit(loginhubId: number, id: string, amount: number, accountId?: string) {
    let cat = await db.query.categories.findFirst({
      where: and(eq(categories.loginhubId, loginhubId), eq(categories.name, 'Investimentos'), eq(categories.type, 'expense'))
    });
    let catId = cat?.id;
    if (!catId) {
      const [newCat] = await db.insert(categories).values({
        loginhubId, name: 'Investimentos', type: 'expense', color: '#3b82f6'
      }).returning();
      catId = newCat!.id;
    }
    
    await db.insert(transactions).values({
      loginhubId,
      amount: String(amount),
      type: 'expense',
      description: 'Depósito Cofrinho',
      occurredAt: new Date(),
      categoryId: catId,
      accountId: accountId || null,
      investmentId: id
    });
    
    // Sync the linked account
    const existing = await db.query.investments.findFirst({
      where: and(eq(investments.id, id), eq(investments.loginhubId, loginhubId))
    });
    if (existing?.accountId) {
      await this.syncAccountBalance(loginhubId, existing.accountId);
    }
  },

  async withdraw(loginhubId: number, id: string, amount: number, accountId?: string) {
    let cat = await db.query.categories.findFirst({
      where: and(eq(categories.loginhubId, loginhubId), eq(categories.name, 'Resgate Investimento'), eq(categories.type, 'income'))
    });
    let catId = cat?.id;
    if (!catId) {
      const [newCat] = await db.insert(categories).values({
        loginhubId, name: 'Resgate Investimento', type: 'income', color: '#10b981'
      }).returning();
      catId = newCat!.id;
    }
    
    await db.insert(transactions).values({
      loginhubId,
      amount: String(amount),
      type: 'income',
      description: 'Resgate Cofrinho',
      occurredAt: new Date(),
      categoryId: catId,
      accountId: accountId || null,
      investmentId: id
    });
    
    // Sync the linked account
    const existing = await db.query.investments.findFirst({
      where: and(eq(investments.id, id), eq(investments.loginhubId, loginhubId))
    });
    if (existing?.accountId) {
      await this.syncAccountBalance(loginhubId, existing.accountId);
    }
  }
};
