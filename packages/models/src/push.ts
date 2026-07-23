import { z } from 'zod';

export const pushSubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

export const pushUnsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

export type PushSubscribePayload = z.infer<typeof pushSubscribeSchema>;
export type PushUnsubscribePayload = z.infer<typeof pushUnsubscribeSchema>;
