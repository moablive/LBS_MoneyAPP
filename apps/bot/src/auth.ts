import type { MiddlewareFn } from 'telegraf';
import type { BotContext } from './context.js';

import { botApi } from '@moneyapp/api-client';

/**
 * Middleware de autenticação: o bot verifica se o Telegram ID está associado
 * a um usuário no banco de dados. Permite o comando /login.
 */
export const auth: MiddlewareFn<BotContext> = async (ctx, next) => {
  const text = ('text' in (ctx.message || {})) ? (ctx.message as any).text : '';
  const isLoginCommand = text && text.startsWith('/login');
  const isLoginScene = ctx.session?.__scenes?.current === 'loginScene';
  const isCallback = ctx.updateType === 'callback_query'; // Also allow callbacks like 'cancel_wizard'

  if (isLoginCommand || isLoginScene) {
    return next();
  }

  // Se for um callback no meio de uma scene, permitimos que passe para o stage lidar
  if (isCallback && isLoginScene) {
    return next();
  }

  const id = ctx.from?.id;
  if (!id) return;

  const user = await botApi.getUserIdByTelegramId(String(id));
  const loginhubId = user?.id;
  if (!loginhubId) {
    if (ctx.chat?.type === 'private' && !isCallback) {
      await ctx.reply('🔒 Você não está autenticado. Use o comando:\n`/login` para iniciar o fluxo de acesso e vincular sua conta do MoneyAPP ao Telegram.', { parse_mode: 'Markdown' });
    }
    return;
  }
  
  return next();
};
