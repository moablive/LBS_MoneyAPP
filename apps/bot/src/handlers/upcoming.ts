import type { BotContext } from '../context.js';
import { getDbUserId } from '../utils/user-cache.js';
import { brl, escHtml } from '../utils/format.js';
import { getUpcomingTransactions } from '../utils/upcoming.js';
import { Icons } from '../ui/icons.js';

export async function showUpcoming(ctx: BotContext) {
  try {
    const userId = await getDbUserId(ctx.from?.id);
    if (!userId) {
      return ctx.reply('Seu usuário não está vinculado!');
    }

    const m = await ctx.reply('⏳ Buscando próximos lançamentos...');

    const fromDate = new Date();
    fromDate.setHours(0, 0, 0, 0);

    const toDate = new Date(fromDate);
    toDate.setMonth(toDate.getMonth() + 1);
    toDate.setHours(23, 59, 59, 999);

    const { upcomingTransactions, categoriesMap } = await getUpcomingTransactions(userId, fromDate, toDate);

    if (upcomingTransactions.length === 0) {
      await ctx.telegram.editMessageText(ctx.chat!.id, m.message_id, undefined, `${Icons.CalendarTitle} <b>Nenhum lançamento pendente pros próximos 30 dias.</b>`, { parse_mode: 'HTML' });
      return;
    }

    const totalUpcoming = upcomingTransactions.reduce((acc, t) => acc + t.amount, 0);

    let msg = `${Icons.CalendarTitle} <b>Próximos Lançamentos (30 dias)</b>\n\n${Icons.Balances} <b>Total:</b> ${brl(totalUpcoming)}\n\n`;

    let currentMonthStr = '';
    for (const t of upcomingTransactions) {
      const txMonth = t.occurredAt.slice(0, 7);
      if (txMonth !== currentMonthStr) {
        currentMonthStr = txMonth;
        const d = new Date(`${txMonth}-01T00:00:00Z`);
        const num = d.toLocaleDateString('pt-BR', { month: '2-digit', timeZone: 'UTC' });
        const name = d.toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' }).toUpperCase();
        msg += `\n${Icons.CalendarMonth} <b>MÊS ${num} • ${name}</b>\n`;
      }
      
      const dayNumStr = new Date(`${t.occurredAt.slice(0, 10)}T00:00:00Z`).toLocaleDateString('pt-BR', { day: '2-digit', timeZone: 'UTC' });
      const dayIcon = Icons.Days[dayNumStr as keyof typeof Icons.Days] || dayNumStr;
      
      let badge = '';
      if (t.isCreditCard) badge = `${Icons.CreditCard} `;
      else if (t.isSubscription) badge = `${Icons.Subscription} `;
      else if (t.isLoan) badge = `${Icons.Loan} `;
      else badge = t.type === 'expense' ? `${Icons.Expense} ` : `${Icons.Income} `;

      let catName = '';
      if (t.categoryId && categoriesMap.has(t.categoryId)) {
        catName = ` (${escHtml(categoriesMap.get(t.categoryId).name)})`;
      }

      msg += `${dayIcon} - ${badge}${escHtml(t.description)}${catName} <b>${brl(t.amount)}</b>\n`;
    }

    if (msg.length > 4000) {
      await ctx.telegram.editMessageText(ctx.chat!.id, m.message_id, undefined, `${Icons.CalendarTitle} <b>Próximos Lançamentos (30 dias)</b>\n\n💰 <b>Total:</b> ${brl(totalUpcoming)}\n\n(A lista é muito longa, exibindo apenas as primeiras transações...)`, { parse_mode: 'HTML' });
      const chunks = msg.match(/.{1,4000}/g) || [];
      for (const chunk of chunks) {
         await ctx.reply(chunk, { parse_mode: 'HTML' });
      }
    } else {
      await ctx.telegram.editMessageText(ctx.chat!.id, m.message_id, undefined, msg, { parse_mode: 'HTML' });
    }
  } catch (err) {
    console.error(err);
    await ctx.reply('Ocorreu um erro ao carregar os próximos lançamentos.');
  }
}
