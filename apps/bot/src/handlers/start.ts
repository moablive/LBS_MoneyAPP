import type { BotContext } from '../context.js';
import { getDbUserId } from '../utils/user-cache.js';
import { mainMenuKeyboard } from '../ui/index.js';

/**
 * Valida que o email do usuário existe no MoneyAPP e mostra o menu principal.
 * Usado tanto pelo /start quanto pela "saída de emergência" dentro das cenas.
 */
export async function sendMainMenu(ctx: BotContext): Promise<void> {
  const userId = await getDbUserId(ctx.from?.id);
  if (!userId) {
    await ctx.reply('Seu email não foi encontrado no banco de dados do MoneyAPP!');
    return;
  }
  await ctx.reply(
    'Bem-vindo ao seu MoneyAPP Bot Integrado! O que deseja fazer?',
    mainMenuKeyboard(),
  );
}
