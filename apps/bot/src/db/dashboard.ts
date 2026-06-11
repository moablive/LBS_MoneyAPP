import { and, eq, sql } from 'drizzle-orm';
import { db, schema } from '@moneyapp/db';

const { accounts } = schema;

export async function getDashboardSummary(userId: string) {
  // Saldo atual = soma de currentBalance onde freezeBalance = false e type != 'credit_card'
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
  
  return {
    currentBalance: balanceRow?.total ? Number(balanceRow.total) : 0,
  };
}

export async function getCreditCardsSummary(userId: string) {
  // Cartões = soma de currentBalance onde type = 'credit_card'
  // E também lista de cartões
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
    
  return cards.map(c => ({
    name: c.name,
    currentBalance: Number(c.currentBalance),
    creditLimit: c.creditLimit ? Number(c.creditLimit) : null,
  }));
}
