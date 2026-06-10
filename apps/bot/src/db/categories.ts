import { and, asc, desc, eq } from 'drizzle-orm';
import { db, schema } from '@moneyapp/db';

const { categories } = schema;

export type TxType = 'income' | 'expense';

export interface Category {
  id: string;
  name: string;
  type: TxType;
  color: string | null;
}

/**
 * Categorias do usuário lidas direto do Postgres oficial do MoneyAPP.
 * Com `type`: ordena por nome. Sem `type`: receitas primeiro, depois por nome
 * (mesma ordenação do bot original).
 */
export function getUserCategories(userId: string, type?: TxType): Promise<Category[]> {
  const where = type
    ? and(eq(categories.userId, userId), eq(categories.type, type))
    : eq(categories.userId, userId);
  const order = type
    ? [asc(categories.name)]
    : [desc(categories.type), asc(categories.name)];

  return db
    .select({
      id: categories.id,
      name: categories.name,
      type: categories.type,
      color: categories.color,
    })
    .from(categories)
    .where(where)
    .orderBy(...order);
}
