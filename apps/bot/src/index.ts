import { Scenes, Telegraf, session } from 'telegraf';
import { env } from './config.js';
import type { BotContext } from './context.js';
import { auth } from './auth.js';
import { registerScene, REGISTER_SCENE } from './scenes/register.js';
import { viewCategoryScene, VIEW_CATEGORY_SCENE } from './scenes/viewCategory.js';
import { attachReceiptScene, ATTACH_RECEIPT_SCENE } from './scenes/attachReceipt.js';
import { sendMainMenu } from './handlers/start.js';
import { showReports, generateReportChart, generateTextReport } from './handlers/reports.js';
import { getDbUserId } from './db/user-cache.js';
import { getUserByEmailWithPassword, updateUserTelegramId } from './db/users.js';
import { createShareLink } from './db/shares.js';
import { Markup } from 'telegraf';
import { mainMenuKeyboard } from './ui.js';

const bot = new Telegraf<BotContext>(env.TELEGRAM_BOT_TOKEN);

// Sessão (necessária para as wizard scenes) + privacidade (1 único usuário).
bot.use(session());
bot.use(auth);

// Fluxos de conversa.
const stage = new Scenes.Stage<BotContext>([registerScene, viewCategoryScene, attachReceiptScene]);
bot.use(stage.middleware());

// Menu principal.
bot.start(sendMainMenu);

// Login
bot.command('login', async (ctx) => {
  const text = ctx.message.text.trim();
  const parts = text.split(/\s+/);
  if (parts.length !== 3) {
    return ctx.reply('Uso: /login <seu_email> <sua_senha>');
  }
  
  const email = parts[1]!;
  const password = parts[2]!;
  
  const user = await getUserByEmailWithPassword(email);
  if (!user) {
    return ctx.reply('Email não encontrado.');
  }

  if (user.defaultPassword) {
    return ctx.reply('🔒 Por motivos de segurança, você deve realizar o seu primeiro login pelo Painel Web e cadastrar uma nova senha antes de usar o bot do Telegram.');
  }
  
  const argon2 = (await import('argon2')).default;
  const valid = await argon2.verify(user.passwordHash, password);
  
  if (!valid) {
    return ctx.reply('Senha incorreta.');
  }
  
  await updateUserTelegramId(user.id, String(ctx.from?.id));
  await ctx.reply('✅ Conta vinculada com sucesso! Bem-vindo ao MoneyAPP Telegram Bot.', mainMenuKeyboard());
});

// Entradas dos fluxos.
bot.hears('📝 Registrar Novo', (ctx) => ctx.scene.enter(REGISTER_SCENE));
bot.command('registrar', (ctx) => ctx.scene.enter(REGISTER_SCENE));
bot.hears('🔍 Ver Categoria', (ctx) => ctx.scene.enter(VIEW_CATEGORY_SCENE));
bot.hears('📎 Anexar Comprovante', (ctx) => ctx.scene.enter(ATTACH_RECEIPT_SCENE));
bot.command('anexar', (ctx) => ctx.scene.enter(ATTACH_RECEIPT_SCENE));

// Relatórios.
bot.hears('📊 Ver Relatórios', showReports);
bot.command('relatorios', showReports);
bot.action(/^REL_(income|expense)$/, (ctx) =>
  generateReportChart(ctx, ctx.match[1] as 'income' | 'expense'),
);
bot.hears('📄 Relatório Geral', generateTextReport);

bot.action(/^share_(.+)$/, async (ctx) => {
  try {
    const categoryId = ctx.match[1];
    const userId = await getDbUserId(ctx.from?.id);
    if (!userId || !categoryId) return;
    
    await ctx.answerCbQuery();
    const { token, password } = await createShareLink(userId, categoryId);
    
    const link = `https://money.astralwavelabel.com/share/${token}`;
    const text = `Confira as movimentações desta categoria no MoneyAPP:\n\n🔗 ${link}\n🔑 Senha: ${password}`;
    
    const waLink = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    
    await ctx.reply(
      `✅ Link de compartilhamento gerado com sucesso!\n\n${text}\n\nO link expira em 24 horas.`,
      Markup.inlineKeyboard([
        [Markup.button.url('🟢 Compartilhar no WhatsApp', waLink)]
      ])
    );
  } catch (err) {
    console.error('Erro ao gerar link de compartilhamento:', err);
    await ctx.reply('Ocorreu um erro ao gerar o link de compartilhamento.');
  }
});

bot.catch((err, ctx) => {
  console.error(`[bot] erro ao processar update ${ctx.updateType}:`, err);
});

// Sonda de inicialização não é mais aplicável a um único usuário.

// launch() resolve no stop normal e rejeita em erro fatal de polling (ex.: 409
// quando outra instância ainda está ativa durante um redeploy). Saída limpa +
// restart do Docker em vez de stack trace e crash.
bot.launch({ dropPendingUpdates: true }).catch((err: unknown) => {
  console.error('[bot] polling encerrado por erro (outra instância ativa / 409?):', err);
  process.exit(1);
});
console.log('🤖 MoneyAPP Bot rodando (Telegraf + @moneyapp/db)...');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
