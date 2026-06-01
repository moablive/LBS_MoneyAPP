import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db, schema } from '@moneyapp/db';
import { requireAuth } from '../middleware/auth.js';

export const usersRouter = Router();

usersRouter.patch('/me/settings', requireAuth, async (req, res, next) => {
  try {
    const { requireReceipts } = req.body;
    const userId = req.user!.id;
    
    const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
    if (!user) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    
    // Merge existing settings with incoming ones
    const newSettings = {
      ...(user.settings as any),
      requireReceipts: typeof requireReceipts === 'boolean' ? requireReceipts : true
    };
    
    await db.update(schema.users)
      .set({ settings: newSettings, updatedAt: new Date() })
      .where(eq(schema.users.id, userId));
      
    res.json(newSettings);
  } catch (err) {
    next(err);
  }
});
