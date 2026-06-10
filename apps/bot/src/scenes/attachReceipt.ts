import { Markup, Scenes } from 'telegraf';
import type { BotContext } from '../context.js';
import { getDbUserId } from '../db/user-cache.js';
import { getRecentTransactionsWithoutReceipt, attachReceipt } from '../db/transactions.js';
import { mainMenuKeyboard } from '../ui.js';
import { sendMainMenu } from '../handlers/start.js';

/**
 * Fluxo de anexo de comprovantes.
 * Lista as últimas 10 transações sem comprovante, permitindo que o usuário
 * selecione uma para adicionar uma foto/PDF.
 */
export const ATTACH_RECEIPT_SCENE = 'attachReceipt';

export interface AttachReceiptState {
  txId?: string;
}

export const attachReceiptScene = new Scenes.WizardScene<BotContext>(
  ATTACH_RECEIPT_SCENE,

  async (ctx) => {
    const userId = await getDbUserId();
    if (!userId) {
      await ctx.reply('Usuário não encontrado.', mainMenuKeyboard());
      return ctx.scene.leave();
    }
    
    // Lista até 10 transações sem comprovante
    const txs = await getRecentTransactionsWithoutReceipt(userId, 10);
    if (txs.length === 0) {
      await ctx.reply('Nenhuma transação recente sem comprovante encontrada.', mainMenuKeyboard());
      return ctx.scene.leave();
    }
    
    const rows = txs.map(tx => [Markup.button.callback(`${tx.description} - R$ ${Math.abs(Number(tx.amount)).toFixed(2)}`, tx.id)]);
    
    await ctx.reply('Selecione a transação para anexar um comprovante (ou digite /cancelar para sair):', Markup.inlineKeyboard(rows));
    return ctx.wizard.next();
  },

  async (ctx) => {
    const cq = ctx.callbackQuery;
    if (!cq || !('data' in cq)) return;
    const txId = cq.data;
    await ctx.answerCbQuery();
    
    (ctx.wizard.state as AttachReceiptState).txId = txId;
    
    await ctx.editMessageText('Agora envie a **FOTO** ou **ARQUIVO** (PDF, imagem) do comprovante:', { parse_mode: 'Markdown' });
    return ctx.wizard.next();
  },

  async (ctx) => {
    const message = ctx.message;
    if (!message) return;
    
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
    
    if (!fileId) {
      await ctx.reply('Formato não suportado. Por favor, envie uma foto ou documento (ex: PDF).');
      return;
    }
    
    // Downloading the file content
    const url = await ctx.telegram.getFileLink(fileId);
    const res = await fetch(url.href);
    const arrayBuffer = await res.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    
    if (base64.length > 5 * 1024 * 1024 * 1.34) {
      await ctx.reply('Arquivo muito grande! O limite para comprovantes é de 5MB.', mainMenuKeyboard());
      return ctx.scene.leave();
    }

    const state = ctx.wizard.state as AttachReceiptState;
    const txId = state.txId!;
    const userId = await getDbUserId();
    
    if (!userId) {
      await ctx.reply('Usuário não encontrado.', mainMenuKeyboard());
      return ctx.scene.leave();
    }

    await attachReceipt(userId, txId, base64, mimeType);
    
    await ctx.reply('✅ Comprovante anexado com sucesso!', mainMenuKeyboard());
    return ctx.scene.leave();
  }
);

attachReceiptScene.command('cancelar', async (ctx) => {
  await ctx.reply('Operação cancelada.', mainMenuKeyboard());
  return ctx.scene.leave();
});
attachReceiptScene.command('start', async (ctx) => {
  await ctx.scene.leave();
  await sendMainMenu(ctx);
});
