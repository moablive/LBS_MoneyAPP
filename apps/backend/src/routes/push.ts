import { Router } from 'express';
import { db, schema } from '@moneyapp/db';
import { and, eq } from 'drizzle-orm';
import { env } from '@moneyapp/services';
import { pushSubscribeSchema, pushUnsubscribeSchema } from '@moneyapp/models';
import crypto from 'crypto';
import webpush from 'web-push';

const pushConfigured = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
if (pushConfigured) {
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
}

export const pushRouter = Router();

pushRouter.use((_req, res, next) => {
  if (!pushConfigured) {
    res.status(503).json({ error: 'push_not_configured' });
    return;
  }
  next();
});

pushRouter.get('/public-key', (_req, res) => {
  res.json({ publicKey: env.VAPID_PUBLIC_KEY });
});

pushRouter.post('/subscribe', async (req, res) => {
  const parsed = pushSubscribeSchema.parse(req.body);
  const loginhubId = req.user?.loginhubId;

  if (!loginhubId) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  await db
    .insert(schema.pushSubscriptions)
    .values({
      id: crypto.randomUUID().slice(0, 8),
      loginhubId,
      endpoint: parsed.endpoint,
      p256dh: parsed.keys.p256dh,
      auth: parsed.keys.auth,
    })
    .onConflictDoUpdate({
      target: schema.pushSubscriptions.endpoint,
      set: { loginhubId, p256dh: parsed.keys.p256dh, auth: parsed.keys.auth },
    });

  // Confirmation push
  try {
    await webpush.sendNotification(
      { endpoint: parsed.endpoint, keys: parsed.keys },
      JSON.stringify({
        title: 'MoneyAPP',
        body: '🔔 Notificações ativadas neste aparelho!',
        url: '/',
      })
    );
  } catch (err) {
    console.error('Falha ao enviar push de confirmação:', err);
  }

  res.status(201).json({ ok: true });
});

pushRouter.post('/unsubscribe', async (req, res) => {
  const parsed = pushUnsubscribeSchema.parse(req.body);
  const loginhubId = req.user?.loginhubId;

  if (!loginhubId) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  await db
    .delete(schema.pushSubscriptions)
    .where(
      and(
        eq(schema.pushSubscriptions.endpoint, parsed.endpoint),
        eq(schema.pushSubscriptions.loginhubId, loginhubId)
      )
    );
  res.status(204).send();
});
