import { Markup, Scenes } from 'telegraf';
import type { BotContext } from '../../context.js';
import type { RegisterState } from '@moneyapp/models';
import { getDbUserId } from '../../utils/user-cache.js';
import { userApi } from '../../utils/api.js';
import { accountKeyboard, mainMenuKeyboard } from '../index.js';
import { sendMainMenu } from '../../handlers/start.js';
import { brl } from '../../utils/format.js';
import { env } from '../../config.js';

export const SCAN_RECEIPT_SCENE = 'scan_receipt';

type ScanState = RegisterState & {
  _accounts?: { id: string; name: string }[];
  _categories?: { id: string; name: string }[];
  extracted?: {
    valor: number;
    tipo: 'expense' | 'income';
    descricao: string;
    data: string; // YYYY-MM-DD
    categoriaNome: string;
  };
  accountId?: string;
};

export const scanReceiptScene = new Scenes.WizardScene<BotContext>(
  SCAN_RECEIPT_SCENE,

  // Passo 0 — Solicita a foto do comprovante
  async (ctx) => {
    await ctx.reply(
      '📸 **Leitura Inteligente (IA)**\n\nEnvie a **FOTO** do comprovante (PIX, nota fiscal, recibo). A nossa IA vai analisar e extrair os dados automaticamente.',
      {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('❌ Cancelar', 'cancel_wizard')],
        ]).reply_markup,
      }
    );
    return ctx.wizard.next();
  },

  // Passo 1 — Recebe a foto, faz OCR via Ollama e extrai os dados
  async (ctx) => {
    const message = ctx.message;
    const cq = ctx.callbackQuery;

    if (cq && 'data' in cq && cq.data === 'cancel_wizard') {
      await ctx.answerCbQuery();
      await ctx.editMessageText('Operação cancelada.');
      await sendMainMenu(ctx);
      return ctx.scene.leave();
    }

    if (!message || !('photo' in message)) {
      await ctx.reply('Por favor, envie uma **FOTO** do comprovante.', {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard([[Markup.button.callback('❌ Cancelar', 'cancel_wizard')]]).reply_markup,
      });
      return;
    }

    const photos = message.photo;
    const fileId = photos[photos.length - 1]!.file_id;
    const url = await ctx.telegram.getFileLink(fileId);
    
    const processingMsg = await ctx.reply('⏳ Analisando imagem com a IA... Isso pode levar alguns segundos.');

    try {
      const res = await fetch(url.href);
      const arrayBuffer = await res.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      
      const state = ctx.wizard.state as ScanState;
      state.receiptBase64 = base64;
      state.receiptMimeType = 'image/jpeg';

      const loginhubId = await getDbUserId(ctx.from?.id);
      if (!loginhubId) {
        await ctx.reply('Seu usuário não está vinculado!');
        return ctx.scene.leave();
      }

      // Busca categorias para ajudar a IA a classificar
      const categoriesExpense = await userApi.get<{id: string, name: string}[]>('/categories?type=expense', loginhubId);
      const categoriesIncome = await userApi.get<{id: string, name: string}[]>('/categories?type=income', loginhubId);
      
      const expenseNames = categoriesExpense.map(c => c.name).join(', ');
      const incomeNames = categoriesIncome.map(c => c.name).join(', ');

      const TZ = 'America/Sao_Paulo';
      const now = new Date();
      const hojeStr = now.toLocaleDateString('en-CA', { timeZone: TZ });

      const prompt = `Analise a imagem deste comprovante/recibo.
Extraia as informações rigorosamente neste formato JSON:
{
  "valor": <numero, ex: 15.50>,
  "tipo": <"expense" para pagamentos feitos ou "income" para recebimentos>,
  "descricao": <"breve descrição ou nome do estabelecimento">,
  "data": <"YYYY-MM-DD" da transação>,
  "categoriaNome": <"Escolha o nome mais apropriado desta lista se for expense: [${expenseNames}] ou desta lista se for income: [${incomeNames}]">
}
Hoje é ${hojeStr} (fuso ${TZ}).
IMPORTANTE sobre a data: use o ano/mês/dia exatos mostrados no comprovante. Se o comprovante mostrar a data SEM o ano (ex: apenas "17/08"), assuma o ANO ATUAL (${now.getFullYear()}) — NUNCA invente ou assuma um ano passado como 2023. Se a imagem não tiver nenhuma data visível, use hoje (${hojeStr}).
Retorne APENAS o JSON válido, sem NENHUM texto adicional ou markdown de código.`;

      const ollamaRes = await fetch(`${env.OLLAMA_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: env.OLLAMA_MODEL,
          prompt,
          images: [base64],
          stream: false,
          format: 'json'
        })
      });

      if (!ollamaRes.ok) {
        throw new Error(`Ollama API error: ${ollamaRes.status} ${ollamaRes.statusText}`);
      }

      const ollamaData = await ollamaRes.json();
      let extractedStr = ollamaData.response?.trim();
      
      if (!extractedStr) {
         throw new Error('Resposta vazia da IA.');
      }

      // Remove blocos de markdown caso a IA retorne ```json ... ```
      extractedStr = extractedStr.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();

      const extracted = JSON.parse(extractedStr);
      state.extracted = {
        valor: Number(extracted.valor),
        tipo: extracted.tipo === 'income' ? 'income' : 'expense',
        descricao: String(extracted.descricao || 'Desconhecido'),
        data: String(extracted.data || new Date().toISOString().split('T')[0]),
        categoriaNome: String(extracted.categoriaNome || ''),
      };
      
      state.tipo = state.extracted.tipo;
      state.valor = state.extracted.valor;
      state.desc = state.extracted.descricao;
      
      // Auto-seleciona categoria
      const allCats = state.tipo === 'expense' ? categoriesExpense : categoriesIncome;
      state._categories = allCats;
      
      const matchedCat = allCats.find(c => c.name.toLowerCase() === state.extracted!.categoriaNome.toLowerCase());
      state.categoryId = matchedCat ? matchedCat.id : allCats[0]?.id;

      // Lista contas para seleção (ou auto-seleciona se houver só 1)
      const accounts = await userApi.get<{id: string, name: string}[]>('/accounts', loginhubId);
      state._accounts = accounts;

      await ctx.telegram.deleteMessage(ctx.chat!.id, processingMsg.message_id);

      if (accounts.length === 1) {
        state.accountId = accounts[0]!.id;
        // Pula para confirmação
        return showConfirmation(ctx, state);
      } else if (accounts.length > 1) {
        const keyboard = accountKeyboard(accounts);
        keyboard.reply_markup.inline_keyboard.push([Markup.button.callback('❌ Cancelar', 'cancel_wizard')]);
        await ctx.reply('🏦 A IA extraiu os dados! Escolha em qual **Conta** registrar:', keyboard);
        return ctx.wizard.next();
      } else {
        await ctx.reply('Você ainda não tem contas cadastradas no MoneyAPP!');
        return ctx.scene.leave();
      }

    } catch (error) {
      console.error('Erro na IA:', error);
      await ctx.telegram.deleteMessage(ctx.chat!.id, processingMsg.message_id).catch(() => {});
      await ctx.reply('Falha ao processar a imagem com a IA. Tente novamente ou use o registro manual.', {
        reply_markup: Markup.inlineKeyboard([[Markup.button.callback('❌ Cancelar', 'cancel_wizard')]]).reply_markup
      });
      return;
    }
  },

  // Passo 2 — Recebe a Conta (se havia mais de 1) e mostra confirmação
  async (ctx) => {
    const cq = ctx.callbackQuery;
    
    if (cq && 'data' in cq && cq.data === 'cancel_wizard') {
      await ctx.answerCbQuery();
      await ctx.editMessageText('Operação cancelada.');
      await sendMainMenu(ctx);
      return ctx.scene.leave();
    }

    if (!cq || !('data' in cq)) {
      return;
    }

    const state = ctx.wizard.state as ScanState;
    state.accountId = cq.data;
    await ctx.answerCbQuery();
    
    await ctx.deleteMessage().catch(() => {});
    return showConfirmation(ctx, state);
  },

  // Passo 3 — Processa a confirmação (Confirmar ou Cancelar)
  async (ctx) => {
    const cq = ctx.callbackQuery;
    if (!cq || !('data' in cq)) return;
    
    const state = ctx.wizard.state as ScanState;

    if (cq.data === 'cancel_wizard') {
      await ctx.answerCbQuery();
      await ctx.editMessageText('Registro descartado.');
      await sendMainMenu(ctx);
      return ctx.scene.leave();
    }

    if (cq.data === 'confirm_save') {
      await ctx.answerCbQuery();
      
      const loginhubId = await getDbUserId(ctx.from?.id);
      if (!loginhubId) {
        await ctx.editMessageText('Seu usuário não está vinculado!');
        return ctx.scene.leave();
      }

      try {
        let occurredAt = new Date(state.extracted!.data);
        if (isNaN(occurredAt.getTime())) occurredAt = new Date(); // fallback

        const payload: any = {
          description: state.desc,
          amount: state.tipo === 'expense' ? -state.valor! : state.valor!,
          type: state.tipo,
          categoryId: state.categoryId,
          accountId: state.accountId,
          occurredAt: occurredAt.toISOString(),
          status: 'paid',
        };
        
        if (state.receiptBase64 && state.receiptMimeType) {
          payload.receipt = {
            base64: state.receiptBase64,
            mimeType: state.receiptMimeType,
          };
        }

        await userApi.post('/transactions', loginhubId, payload);

        await ctx.editMessageText('✅ **Transação Salva com Sucesso!**\nO recibo também foi anexado.', { parse_mode: 'Markdown' });
      } catch (e) {
        console.error(e);
        await ctx.editMessageText('❌ Ocorreu um erro ao salvar a transação.');
      }
      
      await sendMainMenu(ctx);
      return ctx.scene.leave();
    }
  }
);

// Função auxiliar para exibir a confirmação
async function showConfirmation(ctx: any, state: ScanState) {
  const accountName = state._accounts?.find(a => a.id === state.accountId)?.name || 'Desconhecida';
  const categoryName = state._categories?.find(c => c.id === state.categoryId)?.name || 'Desconhecida';
  const label = state.tipo === 'income' ? '🟢 Receita' : '🔴 Despesa';
  
  // Formatando a data
  let formattedDate = state.extracted!.data;
  try {
    const [y, m, d] = state.extracted!.data.split('-');
    if (y && m && d) formattedDate = `${d}/${m}/${y}`;
  } catch(e) {}

  const summary = `
✨ **Resumo Extraído pela IA** ✨

**Tipo:** ${label}
**Descrição:** ${state.desc}
**Data:** ${formattedDate}
**Categoria:** ${categoryName}
**Conta:** ${accountName}
**Valor:** ${brl(state.valor!)}

Tudo correto?`;

  await ctx.reply(summary, {
    parse_mode: 'Markdown',
    reply_markup: Markup.inlineKeyboard([
      [Markup.button.callback('✅ Confirmar e Salvar', 'confirm_save')],
      [Markup.button.callback('❌ Descartar', 'cancel_wizard')]
    ]).reply_markup
  });
  
  // Avança para o passo que aguarda a resposta do inline keyboard
  ctx.wizard.selectStep(3);
}

scanReceiptScene.command('cancelar', async (ctx) => {
  await ctx.reply('Operação cancelada.', mainMenuKeyboard());
  return ctx.scene.leave();
});
scanReceiptScene.command('start', async (ctx: any) => {
  await ctx.scene.leave();
  await sendMainMenu(ctx);
});
