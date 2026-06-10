import { Scenes, Telegraf, session } from 'telegraf';
import { env } from './config.js';
import type { BotContext } from './context.js';
import { auth } from './auth.js';
import { registerScene, REGISTER_SCENE } from './scenes/register.js';
import { viewCategoryScene, VIEW_CATEGORY_SCENE } from './scenes/viewCategory.js';
import { sendMainMenu } from './handlers/start.js';
import { showReports, generateReportChart, generateTextReport } from './handlers/reports.js';
import { getDbUserId } from './db/user-cache.js';

const bot = new Telegraf<BotContext>(env.TELEGRAM_BOT_TOKEN);

// Sessão (necessária para as wizard scenes) + privacidade (1 único usuário).
bot.use(session());
bot.use(auth);

// Fluxos de conversa.
const stage = new Scenes.Stage<BotContext>([registerScene, viewCategoryScene]);
bot.use(stage.middleware());

// Menu principal.
bot.start(sendMainMenu);

// Entradas dos fluxos.
bot.hears('📝 Registrar Novo', (ctx) => ctx.scene.enter(REGISTER_SCENE));
bot.command('registrar', (ctx) => ctx.scene.enter(REGISTER_SCENE));
bot.hears('🔍 Ver Categoria', (ctx) => ctx.scene.enter(VIEW_CATEGORY_SCENE));

// Relatórios.
bot.hears('📊 Ver Relatórios', showReports);
bot.command('relatorios', showReports);
bot.action(/^REL_(income|expense)$/, (ctx) =>
  generateReportChart(ctx, ctx.match[1] as 'income' | 'expense'),
);
bot.hears('📄 Relatório Geral', generateTextReport);

bot.catch((err, ctx) => {
  console.error(`[bot] erro ao processar update ${ctx.updateType}:`, err);
});

// Sonda de inicialização: confirma a conexão com o banco e a resolução do
// usuário. Não derruba o bot se o banco estiver indisponível — apenas avisa.
const probedUserId = await getDbUserId().catch((e: unknown) => {
  console.error('[bot] Falha ao consultar o banco na inicialização:', e);
  return null;
});
console.log(
  probedUserId
    ? `[bot] Usuário resolvido: ${env.USER_EMAIL} -> ${probedUserId}`
    : `[bot] AVISO: email ${env.USER_EMAIL} não encontrado (ou banco indisponível). Tentarei de novo sob demanda.`,
);

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
