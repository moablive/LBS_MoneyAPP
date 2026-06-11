import cron from 'node-cron';
import nodemailer from 'nodemailer';
import { Telegraf } from 'telegraf';
import { env } from '../config.js';
import { botApi } from '@moneyapp/api-client';
import { getUpcomingTransactions } from '../utils/upcoming.js';
import { brl, escHtml } from '../utils/format.js';
import type { BotContext } from '../context.js';

let transporter: nodemailer.Transporter | null = null;

if (env.SMTP_USER && env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: 'smtp.hostinger.com',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });
} else {
  console.warn('⚠️ SMTP_USER ou SMTP_PASS não definidos. Notificações por e-mail desativadas.');
}

async function sendEmailNotification(email: string, htmlContent: string) {
  if (!transporter) return;
  try {
    await transporter.sendMail({
      from: `"MoneyAPP Bot" <${env.SMTP_USER}>`,
      to: email,
      subject: '[MoneyAPP] Aviso de Vencimento (7 dias)',
      html: htmlContent,
    });
    console.log(`✅ E-mail de notificação enviado para ${email}`);
  } catch (error) {
    console.error(`❌ Erro ao enviar e-mail para ${email}:`, error);
  }
}

export function startNotificationsCron(bot: Telegraf<BotContext>) {
  // Roda todos os dias às 08:00 (Fuso horário do sistema/container)
  cron.schedule('0 8 * * *', async () => {
    console.log('⏰ Executando Cron Job: Notificações de Vencimento (7 dias)...');
    try {
      const users = await botApi.getAllBotUsers();
      if (!users || users.length === 0) return;

      // Definir a janela: a partir de hoje até 8 dias, para capturarmos os de exatos 7 dias
      const fromDate = new Date();
      fromDate.setHours(0, 0, 0, 0);
      
      const toDate = new Date(fromDate);
      toDate.setDate(toDate.getDate() + 8);
      toDate.setHours(23, 59, 59, 999);

      // Data alvo (exatos 7 dias a partir de hoje)
      const targetDateStr = new Date(fromDate);
      targetDateStr.setDate(targetDateStr.getDate() + 7);
      const targetYYYYMMDD = targetDateStr.toISOString().slice(0, 10);

      for (const user of users) {
        if (!user.telegramId) continue;

        try {
          const { upcomingTransactions, categoriesMap } = await getUpcomingTransactions(user.id, fromDate, toDate);
          
          // Filtrar as que vencem EXATAMENTE em 7 dias
          const dueIn7Days = upcomingTransactions.filter(t => t.occurredAt.slice(0, 10) === targetYYYYMMDD);
          
          if (dueIn7Days.length === 0) continue;

          let msgText = `⚠️ <b>Aviso de Vencimento</b> ⚠️\n\nVocê tem lançamentos vencendo daqui a <b>exatos 7 dias</b> (${targetDateStr.toLocaleDateString('pt-BR')}):\n\n`;
          let htmlEmail = `<h2>Aviso de Vencimento (7 dias)</h2><p>Você tem lançamentos vencendo em <b>${targetDateStr.toLocaleDateString('pt-BR')}</b>:</p><ul>`;

          let totalDue = 0;

          for (const t of dueIn7Days) {
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
            htmlEmail += `<li>${badge}${t.description}${catName}: <b>${brl(t.amount)}</b></li>`;
          }

          msgText += `\n💰 <b>Total vencendo no dia:</b> ${brl(totalDue)}`;
          htmlEmail += `</ul><p><b>Total:</b> ${brl(totalDue)}</p>`;

          // Enviar Telegram
          await bot.telegram.sendMessage(user.telegramId, msgText, { parse_mode: 'HTML' });
          console.log(`✅ Notificação Telegram enviada para ${user.telegramId}`);

          // Enviar Email
          if (user.email) {
            await sendEmailNotification(user.email, htmlEmail);
          }

        } catch (uErr) {
          console.error(`Erro ao processar notificações para usuário ${user.id}:`, uErr);
        }
      }
    } catch (err) {
      console.error('Erro no Cron Job de Notificações:', err);
    }
  });

  console.log('✅ Cron Job de Notificações agendado para as 08:00 diárias.');
}
