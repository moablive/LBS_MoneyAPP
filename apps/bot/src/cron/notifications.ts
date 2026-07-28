import cron from 'node-cron';
import { Telegraf } from 'telegraf';
import { botApi } from '@moneyapp/api-client';
import { getUpcomingTransactions, UpcomingTransaction } from '../utils/upcoming.js';
import { brl, escHtml } from '../utils/format.js';
import type { BotContext } from '../context.js';
import { isNotificationEnabled } from '../utils/user-cache.js';

async function sendNotificationForDate(
  bot: Telegraf<BotContext>,
  user: any,
  transactions: UpcomingTransaction[],
  categoriesMap: Map<string, any>,
  targetYYYYMMDD: string,
  title: string,
  dateStr: string
) {
  const dueOnDate = transactions.filter(t => t.occurredAt.slice(0, 10) === targetYYYYMMDD);

  if (dueOnDate.length === 0) return;

  // Nome customizado nas configurações do MoneyAPP (Preferências → Nome de exibição)
  const name = (user.displayName || '').trim();
  let msgText = `⚠️ <b>${title}</b> ⚠️\n\n${name ? `${escHtml(name)}, você` : 'Você'} tem lançamentos vencendo ${dateStr}:\n\n`;

  let totalDue = 0;

  for (const t of dueOnDate) {
    totalDue += t.amount;

    let badge = '';
    if (t.isCreditCard) badge = '💳 ';
    else if (t.isSubscription) badge = '🔁 ';
    else if (t.isLoan) badge = '🏦 ';
    else badge = t.type === 'expense' ? '🔴 ' : '🟢 ';

    let catName = '';
    if (t.categoryId && categoriesMap.has(t.categoryId)) {
      catName = ` (${categoriesMap.get(t.categoryId).name})`;
    }

    msgText += `- ${badge}${escHtml(t.description)}${escHtml(catName)}: <b>${brl(t.amount)}</b>\n`;
  }

  msgText += `\n💰 <b>Total vencendo:</b> ${brl(totalDue)}`;

  // Enviar notificação via Telegram
  await bot.telegram.sendMessage(user.telegramId, msgText, { parse_mode: 'HTML' });
  console.log(`✅ Notificação Telegram enviada para ${user.telegramId} (${targetYYYYMMDD})`);
}

export function startNotificationsCron(bot: Telegraf<BotContext>) {
  // Roda todos os dias às 08:00 (fuso do container). Notifica APENAS via Telegram.
  cron.schedule('0 8 * * *', async () => {
    console.log('⏰ Executando Cron Job: Notificações de Vencimento (Hoje e 7 dias)...');
    try {
      const users = await botApi.getAllBotUsers();
      if (!users || users.length === 0) return;

      // Definir a janela: a partir de hoje até 8 dias, para capturarmos os de hoje e exatos 7 dias
      const fromDate = new Date();
      fromDate.setHours(0, 0, 0, 0);

      const toDate = new Date(fromDate);
      toDate.setDate(toDate.getDate() + 8);
      toDate.setHours(23, 59, 59, 999);

      // Data de Hoje
      const todayYYYYMMDD = fromDate.toISOString().slice(0, 10);
      const todayDateStr = '<b>HOJE</b> (' + fromDate.toLocaleDateString('pt-BR') + ')';

      // Data alvo (exatos 7 dias a partir de hoje)
      const targetDateStr = new Date(fromDate);
      targetDateStr.setDate(targetDateStr.getDate() + 7);
      const targetYYYYMMDD = targetDateStr.toISOString().slice(0, 10);
      const targetDateFormatted = 'daqui a <b>exatos 7 dias</b> (' + targetDateStr.toLocaleDateString('pt-BR') + ')';

      for (const user of users) {
        if (!user.telegramId) continue;
        if (!isNotificationEnabled(String(user.telegramId))) continue;

        try {
          const { upcomingTransactions, categoriesMap } = await getUpcomingTransactions(user.id, fromDate, toDate);

          // Notificação de 7 dias
          await sendNotificationForDate(
            bot, user, upcomingTransactions, categoriesMap, targetYYYYMMDD, 
            'Aviso de Vencimento', targetDateFormatted
          );

          // Notificação de Hoje
          await sendNotificationForDate(
            bot, user, upcomingTransactions, categoriesMap, todayYYYYMMDD, 
            'Vencimentos de Hoje', todayDateStr
          );

        } catch (uErr) {
          console.error(`Erro ao processar notificações para usuário ${user.id}:`, uErr);
        }
      }
    } catch (err) {
      console.error('Erro no Cron Job de Notificações:', err);
    }
  });

  console.log('✅ Cron Job de Notificações (Telegram) agendado para as 08:00 diárias (Avisos de Hoje e 7 dias).');
}
