import { eq } from 'drizzle-orm';
import { db, schema } from '@moneyapp/db';
const { users } = schema;
import { env } from './config/env';
import { hashPassword, verifyPassword } from './password';

/**
 * Ensure the configured master users exist on every backend startup.
 * Dynamically discovers users from env matching pattern:
 * MASTER_USER_EMAIL / MASTER_USER_PASSWORD
 * MASTER_USER_{N}_EMAIL / MASTER_USER_{N}_PASSWORD
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

  // 2. Discover numbered master users (MASTER_USER_1_EMAIL, MASTER_USER_2_EMAIL, etc.)
  // We look directly at process.env to find all keys matching the pattern
  const emailRegex = /^MASTER_USER_(\d+)_EMAIL$/;
  
  Object.keys(process.env).forEach(key => {
    const match = key.match(emailRegex);
    if (match) {
      const index = match[1];
      const email = process.env[key]?.trim().toLowerCase();
      const password = process.env[`MASTER_USER_${index}_PASSWORD`]?.trim();
      const name = process.env[`MASTER_USER_${index}_NAME`]?.trim() || `Master ${index}`;

      if (email && password) {
        usersToBootstrap.set(email, { email, name, password });
      }
    }
  });

  // 3. Process the discovered users
  for (const u of usersToBootstrap.values()) {
    if (u.password!.length < 10) {
      // eslint-disable-next-line no-console
      console.warn(`[bootstrap] skipping user ${u.email} because password is too short (min 10 chars)`);
      continue;
    }
    await bootstrapSingleUser(u.email, u.name, u.password!);
  }

  // 4. Synchronize: Remove users from DB that are NOT in the .env list
  const allUsersInDb = await db.query.users.findMany();
  const allowedEmails = Array.from(usersToBootstrap.keys());

  for (const dbUser of allUsersInDb) {
    if (!allowedEmails.includes(dbUser.email.toLowerCase())) {
      // Drizzle delete with cascade (defined in schema.ts) will clean up their data
      await db.delete(users).where(eq(users.id, dbUser.id));
      // eslint-disable-next-line no-console
      console.log(`[bootstrap] removed user no longer in .env: ${dbUser.email}`);
    }
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

  const stillValid = await verifyPassword(existing.passwordHash, password);
  if (stillValid) {
    // eslint-disable-next-line no-console
    console.log(`[bootstrap] master user up-to-date id=${existing.id} email=${email}`);
    return;
  }

  const passwordHash = await hashPassword(password);
  await db
    .update(users)
    .set({ passwordHash, name, updatedAt: new Date() })
    .where(eq(users.id, existing.id));
  // eslint-disable-next-line no-console
  console.log(`[bootstrap] master user password rotated id=${existing.id} email=${email}`);
}
