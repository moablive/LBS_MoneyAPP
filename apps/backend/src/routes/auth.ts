import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db, schema } from '@moneyapp/db';
const { userSettings } = schema;
import { ensureDefaultCategories } from '@moneyapp/services';
import { verifyBearer } from '../middleware/auth.js';

export const authRouter = Router();

/**
 * Provision / sync the local MoneyAPP user for an already-authenticated
 * LoginHub user. Login itself happens on LoginHub — the frontend calls this
 * once right after a successful login, forwarding the LoginHub token.
 * Creates the userSettings row + seeds default categories on first sight.
 */
authRouter.post('/bootstrap', async (req, res, next) => {
  try {
    const payload = verifyBearer(req);
    if (!payload?.sub) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    const userId = payload.sub;

    let settings = await db.query.userSettings.findFirst({ where: eq(userSettings.id, userId) });

    if (!settings) {
      const [created] = await db.insert(userSettings).values({ id: userId }).returning();
      settings = created!;
      await ensureDefaultCategories(userId);
    }

    res.json({ id: settings.id, name: req.body?.name || '', email: payload.email || '', settings: settings.settings });
  } catch (err) {
    next(err);
  }
});
