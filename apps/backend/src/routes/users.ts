import { Router, Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db, schema } from '@moneyapp/db';
import { requireAuth } from '../middleware/auth.js';

export const usersRouter = Router();

// Password lifecycle (set/change/reset) and invites are owned by LoginHub.
// MoneyAPP only keeps app-specific profile settings.
usersRouter.patch('/me/settings', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { requireReceipts } = req.body;
    const loginhubId = req.user!.loginhubId;

    const user = await db.query.userSettings.findFirst({ where: eq(schema.userSettings.loginhubId, loginhubId) });
    if (!user) {
      res.status(404).json({ error: 'not_found' });
      return;
    }

    // Merge existing settings with incoming ones
    const newSettings = {
      ...(user.settings as any),
      ...(typeof requireReceipts === 'boolean' && { requireReceipts }),
      ...(typeof req.body.showTodoAppEvents === 'boolean' && { showTodoAppEvents: req.body.showTodoAppEvents }),
    };

    await db.update(schema.userSettings)
      .set({ settings: newSettings })
      .where(eq(schema.userSettings.loginhubId, loginhubId));

    res.json(newSettings);
  } catch (err) {
    next(err);
  }
});
