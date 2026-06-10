import type { MiddlewareFn } from 'telegraf';
import type { BotContext } from './context.js';
import { env } from './config.js';

/**
 * Middleware de privacidade: o bot só responde ao Telegram ID autorizado.
 * Colocado antes do Stage para bloquear inclusive os fluxos de conversa.
 */
export const auth: MiddlewareFn<BotContext> = (ctx, next) => {
  const id = ctx.from?.id;
  if (id !== env.ALLOWED_USER_ID) {
    console.warn(`[bot] Acesso negado para o Telegram ID: ${id}`);
    return Promise.resolve();
  }
  return next();
};
