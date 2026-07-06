import { Router, Request, Response, NextFunction } from 'express';
import { db, schema } from '@moneyapp/db';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../middleware/auth.js';
import { env } from '@moneyapp/services';

export const integrationsRouter = Router();

integrationsRouter.use(requireAuth);

integrationsRouter.get('/todoapp/tasks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await db.query.userSettings.findFirst({
      where: eq(schema.userSettings.loginhubId, req.user!.loginhubId),
    });

    if (!user || !user.telegramId) {
      return res.json([]);
    }

    const start = req.query.start || '';
    const end = req.query.end || '';

    // Chamada para o bot endpoint do TodoAPP usando a chave de servico
    const todoRes = await fetch(`http://app_todoapp_backend:3000/api/bot/tasks?telegramId=${user.telegramId}&start=${start}&end=${end}`, {
      headers: {
        'x-api-key': env.BOT_SERVICE_KEY
      }
    });

    if (!todoRes.ok) {
      throw new Error(`TodoAPP returned ${todoRes.status}`);
    }

    const data = await todoRes.json();
    res.json(data);
  } catch (error) {
    next(error);
  }
});
