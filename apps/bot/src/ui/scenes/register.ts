import { Markup, Scenes } from 'telegraf';
import type { BotContext } from '../../context.js';
import type { RegisterState } from '@moneyapp/models';
import { getDbUserId } from '../../utils/user-cache.js';
import { userApi } from '../../utils/api.js';
import { categoryKeyboard, accountKeyboard, mainMenuKeyboard } from '../index.js';
import { sendMainMenu } from '../../handlers/start.js';
import { brl } from '../../utils/format.js';

export const REGISTER_SCENE = 'register';

/**
 * Fluxo de registro (Receita/Despesa → Descrição → Valor → Categoria → Salvar),
 * antes equivalente ao ConversationHandler de 3 estados do bot Python.
 */
export const registerScene = new Scenes.WizardScene<BotContext>(
  REGISTER_SCENE,

  // Passo 0 — Inicia a cena, já como Despesa, e pede o comprovante.
  async (ctx) => {
    const state = ctx.wizard.state as RegisterState;
    state.tipo = 'expense';
    
    await ctx.reply(
      'Registrando nova **Despesa**.\n\nEnvie a **FOTO/PDF** do comprovante ou clique no botão abaixo para pular (apenas para categoria Controle):',
      {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('⏭ Pular Comprovante', 'skip_receipt')],
          [Markup.button.callback('❌ Cancelar', 'cancel_wizard')],
        ]).reply_markup
      }
    );
    return ctx.wizard.next();
  },

  // Passo 1 — Recebe o comprovante (ou skip) e lida com a categoria Controle.
  async (ctx) => {
    const message = ctx.message;
    const cq = ctx.callbackQuery;
    const state = ctx.wizard.state as RegisterState;

    let skipped = false;

    if (cq && 'data' in cq && cq.data === 'skip_receipt') {
      await ctx.answerCbQuery();
      skipped = true;
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
          return;
        }

        state.receiptBase64 = base64;
        state.receiptMimeType = mimeType;
      } else if ('text' in message && message.text.trim().startsWith('/')) {
         // ignora comandos
         return;
      } else {
        await ctx.reply('Por favor, envie uma FOTO/PDF válida ou clique no botão para pular:', Markup.inlineKeyboard([
          [Markup.button.callback('⏭ Pular Comprovante', 'skip_receipt')],
          [Markup.button.callback('❌ Cancelar', 'cancel_wizard')]
        ]));
        return;
      }
    } else {
       return;
    }

    const loginhubId = await getDbUserId(ctx.from?.id);
    if (!loginhubId) {
      await ctx.reply('Seu usuário não está vinculado!');
      return ctx.scene.leave();
    }

    // Busca a categoria 'Controle' (ou fallback)
    const categories = await userApi.get<{id: string, name: string}[]>('/categories?type=expense', loginhubId);
    const controleCat = categories.find(c => c.name.toLowerCase().includes('controle')) || categories[0];
    
    if (!controleCat) {
      await ctx.reply('Nenhuma categoria de despesa encontrada. Crie uma pelo painel web primeiro.');
      return ctx.scene.leave();
    }

    state.categoryId = controleCat.id;

    if (skipped) {
      state.waitingFor = 'description';
      await ctx.editMessageText(`Comprovante: Pulado.\nCategoria padrão fixada em **${controleCat.name}**.\n\nAgora digite a **DESCRIÇÃO** da transação.\nExemplo: \`Mercado\``, { 
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard([[Markup.button.callback('❌ Cancelar', 'cancel_wizard')]]).reply_markup
      });
      return ctx.wizard.next();
    } else {
      state.waitingFor = 'category_change_prompt';
      const promptStr = cq ? 'Comprovante: Pulado (Erro, não deveria cair aqui).' : 'Comprovante: Recebido ✅';
      await ctx.reply(`${promptStr}\nCategoria padrão definida como **${controleCat.name}**.\n\nDeseja mudar a categoria?`, {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('Mudar Categoria', 'change_category')],
          [Markup.button.callback('Manter Categoria', 'keep_category')],
          [Markup.button.callback('❌ Cancelar', 'cancel_wizard')]
        ]).reply_markup
      });
      return ctx.wizard.next();
    }
  },

  // Passo 2 — Multiplexador: Lida com a mudança de categoria OU recebe a descrição
  async (ctx) => {
    const state = ctx.wizard.state as RegisterState;

    if (state.waitingFor === 'category_change_prompt') {
      const cq = ctx.callbackQuery;
      if (cq && 'data' in cq) {
        if (cq.data === 'keep_category') {
          await ctx.answerCbQuery();
          await ctx.editMessageText('Categoria mantida.\n\nAgora digite a **DESCRIÇÃO** da transação.\nExemplo: `Mercado`', { 
            parse_mode: 'Markdown',
            reply_markup: Markup.inlineKeyboard([[Markup.button.callback('❌ Cancelar', 'cancel_wizard')]]).reply_markup
          });
          state.waitingFor = 'description';
          return;
        } else if (cq.data === 'change_category') {
          await ctx.answerCbQuery();
          const loginhubId = await getDbUserId(ctx.from?.id);
          const categories = await userApi.get<{id: string, name: string}[]>('/categories?type=expense', loginhubId!);
          const keyboard = categoryKeyboard(categories);
          keyboard.reply_markup.inline_keyboard.push([Markup.button.callback('❌ Cancelar', 'cancel_wizard')]);
          await ctx.editMessageText('Escolha a nova categoria:', keyboard);
          state.waitingFor = 'category_selection';
          return;
        }
      }
      return;
    }

    if (state.waitingFor === 'category_selection') {
      const cq = ctx.callbackQuery;
      if (cq && 'data' in cq) {
        await ctx.answerCbQuery();
        state.categoryId = cq.data;
        await ctx.editMessageText('Categoria selecionada!\n\nAgora digite a **DESCRIÇÃO** da transação.\nExemplo: `Mercado`', { 
          parse_mode: 'Markdown',
          reply_markup: Markup.inlineKeyboard([[Markup.button.callback('❌ Cancelar', 'cancel_wizard')]]).reply_markup
        });
        state.waitingFor = 'description';
        return;
      }
      return;
    }

    if (state.waitingFor === 'description') {
      const message = ctx.message;
      if (!message || !('text' in message)) return;
      const text = message.text.trim();
      if (!text || text.startsWith('/')) return;
      
      state.desc = text;
      await ctx.reply(`Descrição: ${text}\n\nAgora digite o **VALOR**.\nExemplo: \`150.50\``, { 
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard([[Markup.button.callback('❌ Cancelar', 'cancel_wizard')]]).reply_markup
      });
      return ctx.wizard.next();
    }
  },

  // Passo 3 — Recebe Valor, lista contas
  async (ctx) => {
    const message = ctx.message;
    if (!message || !('text' in message)) return;
    
    const textValor = message.text.trim();
    if (textValor.startsWith('/')) return;

    const valor = Number(textValor.replace(',', '.'));
    if (!Number.isFinite(valor) || valor <= 0) {
      await ctx.reply('Valor inválido! Por favor, digite um número maior que zero.\nExemplo: `150.50`', { parse_mode: 'Markdown' });
      return;
    }

    const state = ctx.wizard.state as RegisterState & { _accounts?: {id: string, name: string, type: string}[] };
    state.valor = valor;

    const loginhubId = await getDbUserId(ctx.from?.id);
    if (!loginhubId) {
      await ctx.reply('Seu usuário não está vinculado!');
      return ctx.scene.leave();
    }

    const accounts = await userApi.get<{id: string, name: string, type: string}[]>('/accounts', loginhubId);
    state._accounts = accounts;
    if (accounts.length === 0) {
      await ctx.reply('Você ainda não tem contas cadastradas no MoneyAPP! Crie uma conta no painel web primeiro.');
      return ctx.scene.leave();
    }

    const keyboard = accountKeyboard(accounts);
    keyboard.reply_markup.inline_keyboard.push([Markup.button.callback('❌ Cancelar', 'cancel_wizard')]);
    
    await ctx.reply('Escolha a conta para esta transação:', keyboard);
    return ctx.wizard.next();
  },

  // Passo 4 — Recebe a conta e pergunta a data
  async (ctx) => {
    const cq = ctx.callbackQuery;
    
    if (cq && 'data' in cq && cq.data === 'cancel_wizard') {
      await ctx.answerCbQuery();
      await ctx.editMessageText('Operação cancelada.');
      await sendMainMenu(ctx);
      return ctx.scene.leave();
    }

    if (!cq || !('data' in cq)) {
      if (ctx.message && 'text' in ctx.message) {
        await ctx.reply('Por favor, clique em um dos botões de CONTA acima.');
      }
      return;
    }
    const accountId = cq.data;
    await ctx.answerCbQuery();

    const state = ctx.wizard.state as RegisterState & { _accounts?: {id: string, name: string, type: string}[], accountId?: string };
    state.accountId = accountId;

    await ctx.editMessageText('Qual a data da transação?', {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('Hoje', 'date_today')],
        [Markup.button.callback('Ontem', 'date_yesterday')],
        [Markup.button.callback('❌ Cancelar', 'cancel_wizard')]
      ]).reply_markup
    });
    
    await ctx.reply('Você também pode digitar no formato DD/MM (ex: 15/04).', {
      reply_markup: Markup.inlineKeyboard([[Markup.button.callback('❌ Cancelar', 'cancel_wizard')]]).reply_markup
    });
    
    return ctx.wizard.next();
  },

  // Passo 5 - Recebe a data e pergunta o horário
  async (ctx) => {
    const state = ctx.wizard.state as RegisterState & { _accounts?: {id: string, name: string, type: string}[], accountId?: string, parsedDate?: Date };
    let occurredAt = new Date();

    const cq = ctx.callbackQuery;
    if (cq && 'data' in cq) {
      if (cq.data === 'cancel_wizard') {
        await ctx.answerCbQuery();
        await ctx.editMessageText('Operação cancelada.');
        await sendMainMenu(ctx);
        return ctx.scene.leave();
      }
      await ctx.answerCbQuery();
      if (cq.data === 'date_yesterday') {
        occurredAt.setDate(occurredAt.getDate() - 1);
      }
    } else {
      const message = ctx.message;
      if (!message || !('text' in message)) return;
      const text = message.text.trim();
      if (text.startsWith('/')) return;
      
      const match = text.match(/^(\d{1,2})\/(\d{1,2})$/);
      if (!match) {
        await ctx.reply('Formato inválido. Digite DD/MM (ex: 15/04) ou clique num dos botões acima:', {
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('Hoje', 'date_today')],
            [Markup.button.callback('Ontem', 'date_yesterday')],
            [Markup.button.callback('❌ Cancelar', 'cancel_wizard')]
          ]).reply_markup
        });
        return;
      }
      const day = parseInt(match[1]!, 10);
      const month = parseInt(match[2]!, 10) - 1;
      occurredAt.setMonth(month);
      occurredAt.setDate(day);
    }

    state.parsedDate = occurredAt;

    const msg = 'Qual o horário da transação?';
    const opts = {
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('Agora', 'time_now')],
        [Markup.button.callback('❌ Cancelar', 'cancel_wizard')]
      ]).reply_markup
    };

    if (cq) {
      await ctx.editMessageText(msg, opts);
    } else {
      await ctx.reply(msg, opts);
    }
    
    await ctx.reply('Você também pode digitar no formato HH:MM (ex: 14:30).', {
      reply_markup: Markup.inlineKeyboard([[Markup.button.callback('❌ Cancelar', 'cancel_wizard')]]).reply_markup
    });

    return ctx.wizard.next();
  },

  // Passo 6 - Recebe o horário e salva
  async (ctx) => {
    const state = ctx.wizard.state as RegisterState & { _accounts?: {id: string, name: string, type: string}[], accountId?: string, parsedDate?: Date };
    let occurredAt = state.parsedDate || new Date();

    const cq = ctx.callbackQuery;
    if (cq && 'data' in cq) {
      if (cq.data === 'cancel_wizard') {
        await ctx.answerCbQuery();
        await ctx.editMessageText('Operação cancelada.');
        await sendMainMenu(ctx);
        return ctx.scene.leave();
      }
      await ctx.answerCbQuery();
      if (cq.data === 'time_now') {
        const now = new Date();
        occurredAt.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
      }
    } else {
      const message = ctx.message;
      if (!message || !('text' in message)) return;
      const text = message.text.trim();
      if (text.startsWith('/')) return;
      
      const match = text.match(/^(\d{1,2}):(\d{1,2})$/);
      if (!match) {
        await ctx.reply('Formato inválido. Digite HH:MM (ex: 14:30) ou clique em "Agora":', {
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('Agora', 'time_now')],
            [Markup.button.callback('❌ Cancelar', 'cancel_wizard')]
          ]).reply_markup
        });
        return;
      }
      const hours = parseInt(match[1]!, 10);
      const minutes = parseInt(match[2]!, 10);
      occurredAt.setHours(hours, minutes, 0);
    }

    const loginhubId = await getDbUserId(ctx.from?.id);
    if (!loginhubId) {
      if (cq) {
        await ctx.editMessageText('Seu usuário não está vinculado!');
      } else {
        await ctx.reply('Seu usuário não está vinculado!');
      }
      return ctx.scene.leave();
    }

    const account = state._accounts?.find(a => a.id === state.accountId);
    const accountName = account?.name || 'Desconhecida';
    const accountType = account?.type || 'checking';

    try {
      const payload: any = {
        description: state.desc,
        amount: state.tipo === 'expense' ? -state.valor! : state.valor!,
        type: state.tipo,
        categoryId: state.categoryId,
        accountId: state.accountId,
        occurredAt: occurredAt.toISOString(),
        status: accountType === 'credit_card' ? 'pending' : 'paid',
      };
      
      if (state.receiptBase64 && state.receiptMimeType) {
        payload.receipt = {
          base64: state.receiptBase64,
          mimeType: state.receiptMimeType,
        };
      }

      await userApi.post('/transactions', loginhubId, payload);

      const label = state.tipo === 'income' ? 'Receita' : 'Despesa';
      const formattedDate = occurredAt.toLocaleDateString('pt-BR');
      const formattedTime = occurredAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const successMsg = `✅ Sucesso!\n\nRegistrado no MoneyAPP:\nTipo: ${label}\nConta: ${accountName}\nData: ${formattedDate}\nHorário: ${formattedTime}\nDesc: ${state.desc}\nValor: ${brl(state.valor!)}`;

      if (cq) {
        await ctx.editMessageText(successMsg);
      } else {
        await ctx.reply(successMsg);
      }
    } catch (e) {
      console.error(e);
      if (cq) {
        await ctx.editMessageText('Ocorreu um erro ao registrar a transação.');
      } else {
        await ctx.reply('Ocorreu um erro ao registrar a transação.');
      }
    }
    
    await sendMainMenu(ctx);
    return ctx.scene.leave();
  }
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
