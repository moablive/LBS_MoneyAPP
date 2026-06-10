import { db } from '@moneyapp/db';
import { sharedLinks } from '@moneyapp/db';
import crypto from 'node:crypto';
import argon2 from 'argon2';

export async function createShareLink(userId: string, categoryId: string) {
  const token = crypto.randomBytes(32).toString('hex');
  const password = crypto.randomBytes(6).toString('hex'); // 12 chars
  const passwordHash = await argon2.hash(password);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  const [row] = await db
    .insert(sharedLinks)
    .values({
      userId,
      categoryId,
      token,
      passwordHash,
      expiresAt,
    })
    .returning();

  return { token: row!.token, password };
}
