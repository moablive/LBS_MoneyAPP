import { eq } from 'drizzle-orm';
import { db, schema } from '@moneyapp/db';

const { users } = schema;

/** Resolve o UUID do usuário do MoneyAPP a partir do email cadastrado. */
export async function getUserIdByEmail(email: string): Promise<string | null> {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return user?.id ?? null;
}
