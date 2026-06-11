import { Markup, Scenes } from 'telegraf';
import type { BotContext } from '../../context.js';
import { getDbUserId } from '../../utils/user-cache.js';
import { userApi } from '../../utils/api.js';
import { categoryKeyboard, mainMenuKeyboard } from '../index.js';
import { sendMainMenu } from '../../handlers/start.js';
import { brl } from '../../utils/format.js';

export const CHANGE_CATEGORY_SCENE = 'change-category';

interface ChangeCategoryState {
  transactionId?: string;
  transactionType?: string;
}

export const changeCategoryScene = new Scenes.WizardScene<BotContext>(
  CHANGE_CATEGORY_SCENE,

  // Passo 0 — Lista as últimas 80 transações do mês atual
  async (ctx) => {
    const userId = await getDbUserId(ctx.from?.id);
    if (!userId) {
      await ctx.reply('Seu usuário não está vinculado!');
      return ctx.scene.leave();
    }

    const now = new Date();
    // month format YYYY-MM
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    // Busca até 80 transações do mês atual (limite de botões por msg no telegram é ~100)
    let transactions: any[] = [];
    try {
      transactions = await userApi.get<any[]>(`/transactions?month=${month}&limit=80`, userId);
    } catch (err) {
      console.error(err);
      await ctx.reply('Ocorreu um erro ao buscar suas transações.');
      return ctx.scene.leave();
    }
    
    if (transactions.length === 0) {
      await ctx.reply('Você não tem lançamentos neste mês.', mainMenuKeyboard());
      return ctx.scene.leave();
    }

    const buttons: any[] = [];
    for (const t of transactions) {
      const day = new Date(t.occurredAt).getDate().toString().padStart(2, '0');
      const text = `[${day}] ${t.description} - ${brl(t.amount)}`;
      const label = text.length > 60 ? text.substring(0, 57) + '...' : text;
      // Use 1 button per row because the text is wide
      buttons.push([Markup.button.callback(label, `CHCAT_${t.id}_${t.type}`)]);
    }
    
    buttons.push([Markup.button.callback('❌ Cancelar', 'cancel_wizard')]);

    await ctx.reply(
      'Selecione o lançamento deste mês para trocar a categoria:',
      Markup.inlineKeyboard(buttons)
    );
    return ctx.wizard.next();
  },

  // Passo 1 — Recebe a transação escolhida e lista as categorias do mesmo tipo
  async (ctx) => {
    const cq = ctx.callbackQuery;
    if (!cq || !('data' in cq)) return;
    const data = cq.data;
    
    if (data === 'cancel_wizard') {
      await ctx.answerCbQuery();
      await ctx.editMessageText('Operação cancelada.');
      await sendMainMenu(ctx);
      return ctx.scene.leave();
    }

    if (!data.startsWith('CHCAT_')) return;
    const parts = data.replace('CHCAT_', '').split('_');
    const txId = parts[0];
    const txType = parts[1];
    await ctx.answerCbQuery();

    const userId = await getDbUserId(ctx.from?.id);
    if (!userId) return ctx.scene.leave();

    const state = ctx.wizard.state as ChangeCategoryState;
    state.transactionId = txId;

    // Busca as categorias compatíveis com o tipo da transação
    let categories: any[] = [];
    try {
      categories = await userApi.get<any[]>(`/categories?type=${txType}`, userId);
    } catch (err) {
      console.error(err);
      await ctx.editMessageText('Erro ao buscar categorias.');
      return ctx.scene.leave();
    }

    if (categories.length === 0) {
      await ctx.editMessageText(`Você não tem categorias do tipo ${txType === 'income' ? 'Receita' : 'Despesa'} cadastradas.`);
      return ctx.scene.leave();
    }

    const keyboard = categoryKeyboard(categories);
    keyboard.reply_markup.inline_keyboard.push([Markup.button.callback('❌ Cancelar', 'cancel_wizard')]);

    await ctx.editMessageText(
      `Escolha a nova categoria para a transação:`,
      {
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup
      }
    );
    return ctx.wizard.next();
  },

  // Passo 2 — Recebe a nova categoria e salva
  async (ctx) => {
    const cq = ctx.callbackQuery;
    if (!cq || !('data' in cq)) return;
    const data = cq.data;

    if (data === 'cancel_wizard') {
      await ctx.answerCbQuery();
      await ctx.editMessageText('Operação cancelada.');
      await sendMainMenu(ctx);
      return ctx.scene.leave();
    }

    const categoryId = data;
    await ctx.answerCbQuery();

    const state = ctx.wizard.state as ChangeCategoryState;
    const userId = await getDbUserId(ctx.from?.id);
    if (!userId || !state.transactionId) return ctx.scene.leave();

    try {
      // Faz o patch na transação pela userApi
      await userApi.patch(`/transactions/${state.transactionId}`, userId, {
        categoryId
      });
      await ctx.editMessageText('✅ Categoria da transação atualizada com sucesso!');
    } catch (err) {
      console.error('Erro ao trocar categoria:', err);
      await ctx.editMessageText('Ocorreu um erro ao salvar a nova categoria.');
    }

    await sendMainMenu(ctx);
    return ctx.scene.leave();
  }
);

changeCategoryScene.command('cancelar', async (ctx) => {
  await ctx.reply('Operação cancelada.', mainMenuKeyboard());
  return ctx.scene.leave();
});

changeCategoryScene.command('start', async (ctx) => {
  await ctx.scene.leave();
  await sendMainMenu(ctx);
});
