import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db, schema } from '@moneyapp/db';
const { users } = schema;
import { ensureDefaultCategories } from '@moneyapp/services';
import { verifyBearer } from '../middleware/auth.js';

export const authRouter = Router();

/**
 * Provision / sync the local MoneyAPP user for an already-authenticated
 * LoginHub user. Login itself happens on LoginHub — the frontend calls this
 * once right after a successful login, forwarding the LoginHub token and the
 * user's display name. Creates the row + seeds default categories on first
 * sight; keeps the name in sync afterwards.
 */
authRouter.post('/bootstrap', async (req, res, next) => {
  try {
    const payload = verifyBearer(req);
    const email = payload?.email?.toLowerCase().trim();
    if (!email) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    const providedName = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const name = providedName || email.split('@')[0]!;

    let user = await db.query.users.findFirst({ where: eq(users.email, email) });

    if (!user) {
      const [created] = await db.insert(users).values({ email, name }).returning();
      user = created!;
      await ensureDefaultCategories(user.id);
    } else if (providedName && providedName !== user.name) {
      await db.update(users).set({ name: providedName, updatedAt: new Date() }).where(eq(users.id, user.id));
      user = { ...user, name: providedName };
    }

    res.json({ id: user.id, name: user.name, email: user.email, settings: user.settings });
  } catch (err) {
    next(err);
  }
});
