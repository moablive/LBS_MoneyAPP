import { Markup, Scenes } from 'telegraf';
import type { BotContext, RegisterState } from '../context.js';
import { getDbUserId } from '../db/user-cache.js';
import { getUserCategories } from '../db/categories.js';
import { addTransaction } from '../db/transactions.js';
import { categoryKeyboard, mainMenuKeyboard } from '../ui.js';
import { sendMainMenu } from '../handlers/start.js';
import { brl } from '../utils/format.js';

export const REGISTER_SCENE = 'register';

/**
 * Fluxo de registro (Receita/Despesa → Descrição+Valor → Categoria → Salvar),
 * equivalente ao ConversationHandler de 3 estados do bot Python.
 */
export const registerScene = new Scenes.WizardScene<BotContext>(
  REGISTER_SCENE,

  // Passo 0 — pergunta o tipo.
  async (ctx) => {
    await ctx.reply(
      'É uma Receita ou Despesa?',
      Markup.inlineKeyboard([
        [
          Markup.button.callback('🟢 Receita', 'income'),
          Markup.button.callback('🔴 Despesa', 'expense'),
        ],
      ]),
    );
    return ctx.wizard.next();
  },

  // Passo 1 — recebe o tipo e pede descrição + valor.
  async (ctx) => {
    const cq = ctx.callbackQuery;
    if (!cq || !('data' in cq)) return;
    const data = cq.data;
    if (data !== 'income' && data !== 'expense') return;

    await ctx.answerCbQuery();
    (ctx.wizard.state as RegisterState).tipo = data;
    const label = data === 'income' ? 'Receita' : 'Despesa';
    await ctx.editMessageText(
      `Tipo escolhido: ${label}\n\nAgora digite uma DESCRIÇÃO e o VALOR separados por hífen.\nExemplo: \`Mercado - 150.50\``,
      { parse_mode: 'Markdown' },
    );
    return ctx.wizard.next();
  },

  // Passo 2 — recebe "Descrição - Valor" e lista as categorias do tipo.
  async (ctx) => {
    const message = ctx.message;
    if (!message || !('text' in message)) return;
    const text = message.text;

    if (!text.includes('-')) {
      await ctx.reply('Formato inválido! Por favor, use: `Descrição - Valor` (ex: Mercado - 50.50).', {
        parse_mode: 'Markdown',
      });
      return;
    }

    const parts = text.split('-');
    const desc = parts.slice(0, -1).join('-').trim();
    const valor = Number(parts[parts.length - 1]!.trim().replace(',', '.'));
    if (!desc || !Number.isFinite(valor) || valor <= 0) {
      await ctx.reply('Valor inválido! Por favor, digite no formato: `Descrição - Valor`.', {
        parse_mode: 'Markdown',
      });
      return;
    }

    const state = ctx.wizard.state as RegisterState;
    state.desc = desc;
    state.valor = valor;

    const userId = await getDbUserId();
    if (!userId) {
      await ctx.reply('Seu email não foi encontrado no banco de dados do MoneyAPP!');
      return ctx.scene.leave();
    }

    const cats = await getUserCategories(userId, state.tipo!);
    if (cats.length === 0) {
      await ctx.reply('Você ainda não tem categorias cadastradas no MoneyAPP para esse tipo!');
      return ctx.scene.leave();
    }

    await ctx.reply('Escolha a categoria:', categoryKeyboard(cats));
    return ctx.wizard.next();
  },

  // Passo 3 — recebe a categoria e grava a transação.
  async (ctx) => {
    const cq = ctx.callbackQuery;
    if (!cq || !('data' in cq)) return;
    const categoryId = cq.data;
    await ctx.answerCbQuery();

    const state = ctx.wizard.state as RegisterState;
    const userId = await getDbUserId();
    if (!userId) {
      await ctx.editMessageText('Seu email não foi encontrado no banco de dados do MoneyAPP!');
      return ctx.scene.leave();
    }

    await addTransaction(userId, state.desc!, state.valor!, state.tipo!, categoryId);

    const label = state.tipo === 'income' ? 'Receita' : 'Despesa';
    await ctx.editMessageText(
      `✅ Sucesso!\n\nRegistrado no MoneyAPP:\nTipo: ${label}\nDesc: ${state.desc}\nValor: ${brl(state.valor!)}`,
    );
    return ctx.scene.leave();
  },
);

// Saídas: /cancelar (como no Python) e /start (volta ao menu).
registerScene.command('cancelar', async (ctx) => {
  await ctx.reply('Operação cancelada.', mainMenuKeyboard());
  return ctx.scene.leave();
});
registerScene.command('start', async (ctx) => {
  await ctx.scene.leave();
  await sendMainMenu(ctx);
});
