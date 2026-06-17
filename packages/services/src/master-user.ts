import { and, eq } from 'drizzle-orm';
import { db, schema } from '@moneyapp/db';
const { users } = schema;
import { env } from './config/env';
import { hashPassword, verifyPassword } from './password';

/**
 * Ensure the configured master user exists on every backend startup.
 */
export async function bootstrapMasterUser(): Promise<void> {
  const usersToBootstrap: Map<string, { email: string; name: string; password?: string }> = new Map();

  // 1. Check the primary master user (no suffix)
  if (env.MASTER_USER_EMAIL && env.MASTER_USER_PASSWORD) {
    usersToBootstrap.set(env.MASTER_USER_EMAIL.toLowerCase(), {
      email: env.MASTER_USER_EMAIL.toLowerCase(),
      name: env.MASTER_USER_NAME,
      password: env.MASTER_USER_PASSWORD,
    });
  }

  // 2. Process the master user
  for (const u of usersToBootstrap.values()) {
    if (u.password!.length < 10) {
      // eslint-disable-next-line no-console
      console.warn(`[bootstrap] skipping user ${u.email} because password is too short (min 10 chars)`);
      continue;
    }
    await bootstrapSingleUser(u.email, u.name, u.password!);
  }

  // 3. Ensure all existing users have their default categories
  const allUsersInDb = await db.query.users.findMany();

  for (const dbUser of allUsersInDb) {
    await ensureDefaultCategories(dbUser.id);
  }
}


async function bootstrapSingleUser(email: string, name: string, password: string): Promise<void> {
  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });

  if (!existing) {
    const passwordHash = await hashPassword(password);
    const [created] = await db
      .insert(users)
      .values({ email, name, passwordHash })
      .returning({ id: users.id });
    // eslint-disable-next-line no-console
    console.log(`[bootstrap] master user created id=${created!.id} email=${email}`);
    return;
  }

  // Se a senha já foi alterada pelo usuário (defaultPassword = false), não sobrescrevemos.
  // O admin precisa setar defaultPassword = true no BD manualmente para forçar um reset.
  if (!existing.defaultPassword) {
    return;
  }

  const stillValid = await verifyPassword(existing.passwordHash, password);
  if (stillValid) {
    // eslint-disable-next-line no-console
    console.log(`[bootstrap] master user up-to-date id=${existing.id} email=${email}`);
    return;
  }

  const passwordHash = await hashPassword(password);
  await db
    .update(users)
    .set({ passwordHash, name, defaultPassword: true, updatedAt: new Date() })
    .where(eq(users.id, existing.id));
  // eslint-disable-next-line no-console
  console.log(`[bootstrap] master user password rotated id=${existing.id} email=${email}`);
}

async function ensureDefaultCategories(userId: string): Promise<void> {
  const DEFAULT_CATEGORIES = [
    { name: 'Controle 📊', type: 'expense' },
    { name: 'Alimentação 🍔|/🍽️', type: 'expense' },
    { name: 'Assinaturas 📺', type: 'expense' },
    { name: 'Barbearia & Estética 💈', type: 'expense' },
    { name: 'CARRO 🛻', type: 'expense' },
    { name: 'Casa 🏠', type: 'expense' },
    { name: 'Comunicação 📶', type: 'expense' },
    { name: 'Empréstimos 🧾', type: 'expense' },
    { name: 'Estacionamento 🅿️', type: 'expense' },
    { name: 'Estudos 📚', type: 'expense' },
    { name: 'Farmácia 💊', type: 'expense' },
    { name: 'FATURAS 💳', type: 'expense' },
    { name: 'Impostos 📄', type: 'expense' },
    { name: 'Investimentos 📈', type: 'expense' },
    { name: 'Lazer 🍻', type: 'expense' },
    { name: 'Locações 📦', type: 'expense' },
    { name: 'Mercado 🛒', type: 'expense' },
    { name: 'Salário 💵', type: 'income' },
    { name: 'Saúde 🩺', type: 'expense' },
    { name: 'TI 🤖', type: 'expense' },
    { name: 'Transporte 🚕', type: 'expense' },
    { name: 'Vestuário 👕', type: 'expense' },
    { name: 'Viagens 🎒', type: 'expense' },
    { name: 'Honorários 💼', type: 'income' },
    { name: 'Combustível ⛽', type: 'expense' },
    { name: 'Contabilidade 🧮', type: 'expense' },
    { name: 'Advogado ⚖️', type: 'expense' },
    { name: 'Pensão 💸', type: 'expense' },
    { name: 'Lavagem 🧽', type: 'expense' }
  ] as const;

  const PRESET_COLORS = [
    '#ef4444', '#f97316', '#eab308', '#22c55e',
    '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'
  ];

  for (const [i, cat] of DEFAULT_CATEGORIES.entries()) {
    const existing = await db.query.categories.findFirst({
      where: and(
        eq(schema.categories.userId, userId),
        eq(schema.categories.name, cat.name),
        eq(schema.categories.type, cat.type as 'expense' | 'income')
      )
    });

    if (!existing) {
      await db.insert(schema.categories).values({
        userId,
        name: cat.name,
        type: cat.type as 'expense' | 'income',
        color: PRESET_COLORS[i % PRESET_COLORS.length]
      });
    }
  }
}

