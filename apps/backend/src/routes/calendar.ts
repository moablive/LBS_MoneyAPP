import { Router } from 'express';
import { db, schema } from '@moneyapp/db';
import { eq, and, gte, lt } from 'drizzle-orm';
import * as ics from 'ics';
import { EventAttributes } from 'ics';

export const calendarRouter = Router();

calendarRouter.get('/:token.ics', async (req, res, next) => {
  try {
    const { token } = req.params;
    
    // Find the user by token
    const user = await db.query.users.findFirst({
      where: eq(schema.users.calendarSyncToken, token)
    });

    if (!user) {
      res.status(404).send('Calendar not found');
      return;
    }

    const userId = user.id;
    const now = new Date();
    const fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const toDate = new Date(now.getFullYear(), now.getMonth() + 3, 0);

    // Fetch transactions
    const txs = await db.query.transactions.findMany({
      where: and(
        eq(schema.transactions.userId, userId),
        eq(schema.transactions.status, 'pending'),
        gte(schema.transactions.occurredAt, fromDate),
        lt(schema.transactions.occurredAt, toDate)
      )
    });

    // In a real app we would also fetch loans and subscriptions here, 
    // but to keep it simple and functional we will just use transactions.
    
    const events: EventAttributes[] = txs.map(t => {
      const d = new Date(t.occurredAt);
      return {
        title: `${t.type === 'expense' ? 'Despesa' : 'Receita'}: ${t.description}`,
        description: `Valor: ${Number(t.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}\nStatus: Pendente`,
        start: [d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes()],
        duration: { hours: 1 },
        uid: `tx-${t.id}@moneyapp.com`
      };
    });

    if (events.length === 0) {
      // Add a dummy event to avoid empty calendar errors
      events.push({
        title: 'MoneyAPP: Nenhuma transação',
        start: [now.getFullYear(), now.getMonth() + 1, now.getDate(), now.getHours(), now.getMinutes()],
        duration: { minutes: 15 },
        uid: `dummy-${now.getTime()}@moneyapp.com`
      });
    }

    ics.createEvents(events, (error, value) => {
      if (error) {
        next(error);
        return;
      }
      
      res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="moneyapp.ics"`);
      res.send(value);
    });

  } catch (err) {
    next(err);
  }
});
