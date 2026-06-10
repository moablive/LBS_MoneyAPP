import { and, desc, eq, sql, isNull } from 'drizzle-orm';
import { db, schema } from '@moneyapp/db';
import type { TxType } from './categories.js';

const { transactions, categories } = schema;

/** Filtro SQL "ocorreu no mês corrente" reutilizado pelos resumos mensais. */
const currentMonth = sql`date_trunc('month', ${transactions.occurredAt}) = date_trunc('month', now())`;

/**
 * Insere uma transação no banco oficial do MoneyAPP.
 * Valor com sinal: negativo = despesa, positivo = receita (mesma convenção do
 * schema/web). `amount` é numeric(14,2), então gravamos como string com 2 casas.
 */
export async function addTransaction(
  userId: string,
  description: string,
  amount: number,
  type: TxType,
  categoryId: string,
): Promise<void> {
  const signed = type === 'expense' ? -Math.abs(amount) : Math.abs(amount);
  await db.insert(transactions).values({
    userId,
    description,
    amount: signed.toFixed(2),
    type,
    status: 'paid',
    occurredAt: new Date(),
    categoryId,
  });
}

export interface SummaryRow {
  name: string;
  color: string | null;
  total: number;
}

/** Total por categoria (todo o histórico) para um tipo — alimenta o gráfico de pizza. */
export async function getSummaryByCategory(userId: string, type: TxType): Promise<SummaryRow[]> {
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

  return rows.map((r) => ({ name: r.name, color: r.color, total: Number(r.total) }));
}

export interface CategoryDetail {
  total: number;
  transactions: { description: string; amount: number; occurredAt: Date }[];
}

/** Total do mês + últimas 5 movimentações de uma categoria. */
export async function getTransactionsByCategory(
  userId: string,
  categoryId: string,
): Promise<CategoryDetail> {
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

  return {
    total,
    transactions: txs.map((t) => ({
      description: t.description,
      amount: Number(t.amount),
      occurredAt: t.occurredAt,
    })),
  };
}

export interface AllSummaryRow {
  name: string;
  type: TxType;
  total: number;
}

/** Resumo geral do mês corrente, agrupado por categoria (receitas primeiro). */
export async function getAllSummaries(userId: string): Promise<AllSummaryRow[]> {
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

  return rows.map((r) => ({ name: r.name, type: r.type, total: Number(r.total) }));
}

export async function getRecentTransactionsWithoutReceipt(userId: string, limitCount = 5) {
  return await db
    .select({
      id: transactions.id,
      description: transactions.description,
      amount: transactions.amount,
      occurredAt: transactions.occurredAt,
    })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), isNull(transactions.receiptBase64)))
    .orderBy(desc(transactions.occurredAt))
    .limit(limitCount);
}

export async function attachReceipt(userId: string, txId: string, base64: string, mimeType: string) {
  await db
    .update(transactions)
    .set({ receiptBase64: base64, receiptMimeType: mimeType, updatedAt: new Date() })
    .where(and(eq(transactions.id, txId), eq(transactions.userId, userId)));
}
