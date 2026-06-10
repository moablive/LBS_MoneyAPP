import type { MiddlewareFn } from 'telegraf';
import type { BotContext } from './context.js';

import { getUserIdByTelegramId } from './db/users.js';

/**
 * Middleware de autenticação: o bot verifica se o Telegram ID está associado
 * a um usuário no banco de dados. Permite o comando /login.
 */
export const auth: MiddlewareFn<BotContext> = async (ctx, next) => {
  const text = ('text' in (ctx.message || {})) ? (ctx.message as any).text : '';
  if (text && text.startsWith('/login')) {
    return next();
  }

  const id = ctx.from?.id;
  if (!id) return;

  const userId = await getUserIdByTelegramId(String(id));
  if (!userId) {
    if (ctx.chat?.type === 'private') {
      await ctx.reply('🔒 Você não está autenticado. Use o comando:\n`/login seu_email sua_senha`\n\nPara vincular sua conta do MoneyAPP ao Telegram.', { parse_mode: 'Markdown' });
    }
    return;
  }
  
  return next();
};
