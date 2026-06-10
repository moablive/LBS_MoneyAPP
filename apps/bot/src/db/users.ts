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

export async function getUserByEmailWithPassword(email: string) {
  const [user] = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return user ?? null;
}

export async function getUserIdByTelegramId(telegramId: string): Promise<string | null> {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.telegramId, telegramId))
    .limit(1);
  return user?.id ?? null;
}

export async function updateUserTelegramId(userId: string, telegramId: string): Promise<void> {
  await db.update(users).set({ telegramId }).where(eq(users.id, userId));
}
