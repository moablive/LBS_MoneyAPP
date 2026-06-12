import { Scenes, Telegraf, session } from 'telegraf';
import { env } from './config.js';
import jwt from 'jsonwebtoken';
import type { BotContext } from './context.js';
import { auth } from './auth.js';
import { registerScene, REGISTER_SCENE } from './ui/scenes/register.js';
import { viewCategoryScene, VIEW_CATEGORY_SCENE } from './ui/scenes/viewCategory.js';
import { attachReceiptScene, ATTACH_RECEIPT_SCENE } from './ui/scenes/attachReceipt.js';
import { loginScene, LOGIN_SCENE } from './ui/scenes/login.js';
import { changeCategoryScene, CHANGE_CATEGORY_SCENE } from './ui/scenes/changeCategory.js';
import { sendMainMenu } from './handlers/start.js';
import { showReports, generateReportChart, generateTextReport } from './handlers/reports.js';
import { showDashboard, showCards, showBalances } from './handlers/dashboard.js';
import { showUpcoming } from './handlers/upcoming.js';
import { showLoans, showLoanList } from './handlers/loans.js';
import { startNotificationsCron } from './cron/notifications.js';
import { getDbUserId } from './utils/user-cache.js';
import { Icons } from './ui/icons.js';
import { setupApi, botApi } from '@moneyapp/api-client';
import { Markup } from 'telegraf';

const botToken = jwt.sign({ sub: 'telegram-bot', email: 'bot@moneyapp' }, env.JWT_SECRET);
setupApi({ baseUrl: env.BACKEND_URL, getToken: () => botToken });

const bot = new Telegraf<BotContext>(env.TELEGRAM_BOT_TOKEN);

// Sessão (necessária para as wizard scenes) + privacidade (1 único usuário).
bot.use(session());
bot.use(auth);

// Inicia os Cron Jobs em Background
startNotificationsCron(bot);

// Fluxos de conversa.
const stage = new Scenes.Stage<BotContext>([registerScene, viewCategoryScene, attachReceiptScene, loginScene, changeCategoryScene]);
bot.use(stage.middleware());

// Menu principal.
bot.start(sendMainMenu);

// Login
bot.command('login', (ctx) => ctx.scene.enter(LOGIN_SCENE));

// Entradas dos fluxos.
bot.hears(`${Icons.NewRecord} Registrar Novo`, (ctx) => ctx.scene.enter(REGISTER_SCENE));
bot.command('registrar', (ctx) => ctx.scene.enter(REGISTER_SCENE));
bot.hears(`${Icons.Category} Ver Categoria`, (ctx) => ctx.scene.enter(VIEW_CATEGORY_SCENE));
bot.hears(`${Icons.ChangeCategory} Trocar Categoria`, (ctx) => ctx.scene.enter(CHANGE_CATEGORY_SCENE));
bot.command('anexar', (ctx) => ctx.scene.enter(ATTACH_RECEIPT_SCENE));

// Dashboard e Cartões
bot.hears(`${Icons.Dashboard} Dashboard`, showDashboard);
bot.hears(`${Icons.Cards} Cartões`, showCards);
bot.hears(`${Icons.Balances} Saldos das Contas`, showBalances);
bot.hears(`${Icons.Upcoming} Próximos Lançamentos`, showUpcoming);

// Relatórios.
bot.hears(`${Icons.Reports} Ver Relatórios`, showReports);
bot.hears(`${Icons.Loans} Empréstimos`, showLoans);

bot.action(/^LOANS_(given|received)$/, (ctx) => showLoanList(ctx, ctx.match[1] as 'given' | 'received'));

bot.command('relatorios', showReports);
bot.action(/^REL_(income|expense)$/, (ctx) =>
  generateReportChart(ctx, ctx.match[1] as 'income' | 'expense'),
);
// Relatório Geral
bot.hears(`${Icons.GeneralReport} Relatório Geral`, generateTextReport);

// Compartilhar
bot.action(/^share_(.+)$/, async (ctx) => {
  try {
    const categoryId = ctx.match[1];
    const userId = await getDbUserId(ctx.from?.id);
    if (!userId || !categoryId) return;
    
    await ctx.answerCbQuery();
    const { token, password } = await botApi.createShareLink(userId, categoryId);
    
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
