import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { db, schema } from '@moneyapp/db';
import { requireAuth } from '../middleware/auth.js';

export const usersRouter = Router();
import { hashPassword } from '@moneyapp/services';
import crypto from 'node:crypto';


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

usersRouter.post('/me/password', requireAuth, async (req, res, next) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({ error: 'password_too_short' });
      return;
    }
    
    const userId = req.user!.id;
    const passwordHash = await hashPassword(newPassword);
    
    await db.update(schema.users)
      .set({ 
        passwordHash, 
        defaultPassword: false, 
        updatedAt: new Date() 
      })
      .where(eq(schema.users.id, userId));
      
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

usersRouter.get('/me/calendar-token', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
    if (!user) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    
    res.json({ token: user.calendarSyncToken });
  } catch (err) {
    next(err);
  }
});

usersRouter.post('/me/calendar-token', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const newToken = crypto.randomBytes(32).toString('hex');
    
    await db.update(schema.users)
      .set({ calendarSyncToken: newToken, updatedAt: new Date() })
      .where(eq(schema.users.id, userId));
      
    res.json({ token: newToken });
  } catch (err) {
    next(err);
  }
});

usersRouter.post('/invite', requireAuth, async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: 'missing_email' });
      return;
    }

    const emailLower = email.toLowerCase().trim();

    const existing = await db.query.users.findFirst({ where: eq(schema.users.email, emailLower) });
    if (existing) {
      res.status(400).json({ error: 'user_already_exists' });
      return;
    }

    const temporaryPassword = crypto.randomBytes(6).toString('hex');
    const passwordHash = await hashPassword(temporaryPassword);
    
    const name = emailLower.split('@')[0];

    await db.insert(schema.users).values({
      email: emailLower,
      name,
      passwordHash,
      defaultPassword: true,
    });

    res.json({
      success: true,
      email: emailLower,
      temporaryPassword,
      telegramLink: 'https://t.me/awl_money_bot'
    });
  } catch (err) {
    next(err);
  }
});

usersRouter.post('/reset-password', requireAuth, async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: 'missing_email' });
      return;
    }

    const emailLower = email.toLowerCase().trim();

    const existing = await db.query.users.findFirst({ where: eq(schema.users.email, emailLower) });
    if (!existing) {
      res.status(404).json({ error: 'user_not_found' });
      return;
    }

    const temporaryPassword = crypto.randomBytes(6).toString('hex');
    const passwordHash = await hashPassword(temporaryPassword);

    await db.update(schema.users)
      .set({ passwordHash, defaultPassword: true, updatedAt: new Date() })
      .where(eq(schema.users.id, existing.id));

    res.json({
      success: true,
      email: emailLower,
      temporaryPassword,
      telegramLink: 'https://t.me/awl_money_bot'
    });
  } catch (err) {
    next(err);
  }
});
