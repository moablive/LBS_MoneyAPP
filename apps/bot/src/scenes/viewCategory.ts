import { Markup, Scenes } from 'telegraf';
import type { BotContext } from '../context.js';
import { getDbUserId } from '../db/user-cache.js';
import { getUserCategories } from '../db/categories.js';
import { getTransactionsByCategory } from '../db/transactions.js';
import { categoryKeyboard, mainMenuKeyboard } from '../ui.js';
import { sendMainMenu } from '../handlers/start.js';
import { brl, dmy, escHtml } from '../utils/format.js';

export const VIEW_CATEGORY_SCENE = 'view-category';

/**
 * Fluxo de visualização (Tipo → Categoria → Detalhes), equivalente ao
 * ConversationHandler de 2 estados do bot Python.
 */
export const viewCategoryScene = new Scenes.WizardScene<BotContext>(
  VIEW_CATEGORY_SCENE,

  // Passo 0 — pergunta o tipo.
  async (ctx) => {
    await ctx.reply(
      'Deseja ver categorias de Receita ou Despesa?',
      Markup.inlineKeyboard([
        [
          Markup.button.callback('🟢 Receitas', 'income'),
          Markup.button.callback('🔴 Despesas', 'expense'),
        ],
        [Markup.button.callback('❌ Cancelar', 'cancel_wizard')],
      ]),
    );
    return ctx.wizard.next();
  },

  // Passo 1 — lista as categorias do tipo escolhido.
  async (ctx) => {
    const cq = ctx.callbackQuery;
    if (!cq || !('data' in cq)) return;
    const type = cq.data;
    if (type !== 'income' && type !== 'expense') return;

    await ctx.answerCbQuery();
    const userId = await getDbUserId(ctx.from?.id);
    if (!userId) {
      await ctx.editMessageText('Seu usuário não está vinculado!');
      return ctx.scene.leave();
    }

    const cats = await getUserCategories(userId, type);
    if (cats.length === 0) {
      await ctx.editMessageText('Você ainda não tem categorias cadastradas no MoneyAPP para esse tipo!');
      return ctx.scene.leave();
    }

    const label = type === 'income' ? 'Receitas' : 'Despesas';
    const keyboard = categoryKeyboard(cats);
    keyboard.reply_markup.inline_keyboard.push([Markup.button.callback('❌ Cancelar', 'cancel_wizard')]);
    await ctx.editMessageText(
      `Mostrando suas categorias de ${label}. Escolha uma para ver os detalhes:`,
      keyboard,
    );
    return ctx.wizard.next();
  },

  // Passo 2 — mostra total do mês e as últimas 5 movimentações.
  async (ctx) => {
    const cq = ctx.callbackQuery;
    if (!cq || !('data' in cq)) return;
    const categoryId = cq.data;
    await ctx.answerCbQuery();

    const userId = await getDbUserId(ctx.from?.id);
    if (!userId) {
      await ctx.editMessageText('Seu usuário não está vinculado!');
      return ctx.scene.leave();
    }

    const { total, transactions } = await getTransactionsByCategory(userId, categoryId);

    let msg = `📊 <b>Resumo da Categoria (Mês Atual)</b>\n\n💰 <b>Total:</b> ${brl(total)}\n\n`;
    if (transactions.length) {
      msg += '📝 <b>Últimas 5 movimentações:</b>\n';
      for (const t of transactions) {
        msg += `- ${escHtml(t.description)} (${brl(t.amount)}) em ${dmy(t.occurredAt)}\n`;
      }
    } else {
      msg += 'Nenhuma transação nesta categoria neste mês.';
    }

    await ctx.editMessageText(msg, { 
      parse_mode: 'HTML',
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('🔗 Compartilhar Categoria', `share_${categoryId}`)]
      ]).reply_markup
    });
    return ctx.scene.leave();
  },
);

viewCategoryScene.command('cancelar', async (ctx) => {
  await ctx.reply('Visualização cancelada.', mainMenuKeyboard());
  return ctx.scene.leave();
});
viewCategoryScene.action('cancel_wizard', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageText('Operação cancelada.');
  await sendMainMenu(ctx);
  return ctx.scene.leave();
});
viewCategoryScene.command('start', async (ctx) => {
  await ctx.scene.leave();
  await sendMainMenu(ctx);
});
