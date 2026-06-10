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
 * Fluxo de registro (Receita/Despesa → Descrição → Valor → Categoria → Salvar),
 * antes equivalente ao ConversationHandler de 3 estados do bot Python.
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
        [Markup.button.callback('❌ Cancelar', 'cancel_wizard')],
      ]),
    );
    return ctx.wizard.next();
  },

  // Passo 1 — recebe o tipo e pede o comprovante (ou pular).
  async (ctx) => {
    const cq = ctx.callbackQuery;
    if (!cq || !('data' in cq)) return;
    const data = cq.data;
    if (data !== 'income' && data !== 'expense') return;

    await ctx.answerCbQuery();
    (ctx.wizard.state as RegisterState).tipo = data;
    const label = data === 'income' ? 'Receita' : 'Despesa';
    await ctx.editMessageText(
      `Tipo escolhido: ${label}\n\nEnvie a **FOTO/PDF** do comprovante ou clique no botão abaixo para pular:`,
      Markup.inlineKeyboard([
        [Markup.button.callback('⏭ Pular Comprovante', 'skip_receipt')],
        [Markup.button.callback('❌ Cancelar', 'cancel_wizard')],
      ]),
    );
    return ctx.wizard.next();
  },

  // Passo 2 — recebe o comprovante (ou pula) e pede a descrição.
  async (ctx) => {
    const message = ctx.message;
    const cq = ctx.callbackQuery;

    if (cq && 'data' in cq && cq.data === 'skip_receipt') {
      await ctx.answerCbQuery();
    } else if (message) {
      let fileId: string | undefined;
      let mimeType = 'image/jpeg';
      
      if ('photo' in message) {
        const photos = message.photo;
        if (photos && photos.length > 0) {
          fileId = photos[photos.length - 1]!.file_id;
        }
      } else if ('document' in message) {
        fileId = message.document.file_id;
        mimeType = message.document.mime_type || 'application/octet-stream';
      }
      
      if (fileId) {
        const url = await ctx.telegram.getFileLink(fileId);
        const res = await fetch(url.href);
        const arrayBuffer = await res.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        
        if (base64.length > 5 * 1024 * 1024 * 1.34) {
          await ctx.reply('Arquivo muito grande! O limite para comprovantes é de 5MB. Envie um arquivo menor ou pule:', Markup.inlineKeyboard([
            [Markup.button.callback('⏭ Pular Comprovante', 'skip_receipt')],
            [Markup.button.callback('❌ Cancelar', 'cancel_wizard')]
          ]));
          return; // retry step
        }

      const state = ctx.wizard.state as RegisterState;
      state.receiptBase64 = base64;
      state.receiptMimeType = mimeType;
    } else if ('text' in message && message.text.trim().startsWith('/')) {
       // handle commands like /cancelar inside wizard
    } else {
      await ctx.reply('Por favor, envie uma FOTO/PDF válida ou clique no botão para pular:', Markup.inlineKeyboard([
        [Markup.button.callback('⏭ Pular Comprovante', 'skip_receipt')],
        [Markup.button.callback('❌ Cancelar', 'cancel_wizard')]
      ]));
      return; // retry step
    }
    } else {
       return;
    }

    if (cq) {
      await ctx.editMessageText('Comprovante: Pulado.\n\nAgora digite a **DESCRIÇÃO** da transação.\nExemplo: `Mercado`', { 
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard([[Markup.button.callback('❌ Cancelar', 'cancel_wizard')]]).reply_markup
      });
    } else {
      await ctx.reply('Comprovante: Recebido ✅\n\nAgora digite a **DESCRIÇÃO** da transação.\nExemplo: `Mercado`', { 
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard([[Markup.button.callback('❌ Cancelar', 'cancel_wizard')]]).reply_markup
      });
    }
    
    return ctx.wizard.next();
  },

  // Passo 3 — recebe Descrição e pede o Valor.
  async (ctx) => {
    const message = ctx.message;
    if (!message || !('text' in message)) return;
    const text = message.text.trim();

    if (!text) {
      await ctx.reply('Descrição inválida! Por favor, digite uma descrição.');
      return;
    }

    const state = ctx.wizard.state as RegisterState;
    state.desc = text;

    await ctx.reply(
      `Descrição: ${text}\n\nAgora digite o **VALOR**.\nExemplo: \`150.50\``,
      { 
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard([[Markup.button.callback('❌ Cancelar', 'cancel_wizard')]]).reply_markup
      },
    );
    return ctx.wizard.next();
  },

  // Passo 4 — recebe o Valor e lista as categorias do tipo.
  async (ctx) => {
    const message = ctx.message;
    if (!message || !('text' in message)) return;
    
    // allow parsing with comma or dot
    const valor = Number(message.text.trim().replace(',', '.'));
    if (!Number.isFinite(valor) || valor <= 0) {
      await ctx.reply('Valor inválido! Por favor, digite um número maior que zero.\nExemplo: `150.50`', {
        parse_mode: 'Markdown',
      });
      return;
    }

    const state = ctx.wizard.state as RegisterState;
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

    const keyboard = categoryKeyboard(cats);
    keyboard.reply_markup.inline_keyboard.push([Markup.button.callback('❌ Cancelar', 'cancel_wizard')]);
    await ctx.reply('Escolha a categoria:', keyboard);
    return ctx.wizard.next();
  },

  // Passo 5 — recebe a categoria e grava a transação.
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

    await addTransaction(userId, state.desc!, state.valor!, state.tipo!, categoryId, state.receiptBase64, state.receiptMimeType);

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
registerScene.action('cancel_wizard', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageText('Operação cancelada.');
  await sendMainMenu(ctx);
  return ctx.scene.leave();
});
registerScene.command('start', async (ctx) => {
  await ctx.scene.leave();
  await sendMainMenu(ctx);
});
