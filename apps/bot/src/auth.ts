import type { MiddlewareFn } from 'telegraf';
import type { BotContext } from './context.js';

import { botApi } from '@moneyapp/api-client';

/**
 * Identidade central: vale quem tem a conta do LoginHub vinculada a este
 * Telegram. O vínculo nasce no app (Configurações → Vincular Telegram), com a
 * pessoa já autenticada e com 2FA cumprido — nunca por senha digitada no chat.
 */
export const auth: MiddlewareFn<BotContext> = async (ctx, next) => {
  const isCallback = ctx.updateType === 'callback_query';

  const id = ctx.from?.id;
  if (!id) return;

  const user = await botApi.getUserIdByTelegramId(String(id));
  const loginhubId = user?.id;
  if (!loginhubId) {
    if (ctx.chat?.type === 'private' && !isCallback) {
      // O `/login` saiu: pedia e-mail, senha e o codigo do 2FA DENTRO do chat, e
      // tudo isso fica no historico do Telegram. O vinculo nasce no app agora.
      await ctx.reply(
        '🔒 <b>Este bot precisa da sua conta do MoneyAPP.</b>\n\n' +
          'Abra <b>https://money.astralwavelabel.com</b> no navegador, entre na sua ' +
          'conta e use <b>Configurações → Vincular Telegram</b>. O link que aparecer ' +
          'abre esta conversa e conclui sozinho.\n\n' +
          '<i>Senha e código do autenticador nunca são digitados aqui.</i>',
        { parse_mode: 'HTML' },
      );
    }
    return;
  }
  
  return next();
};
