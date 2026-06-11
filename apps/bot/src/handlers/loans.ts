import { Markup } from 'telegraf';
import type { BotContext } from '../context.js';
import { getDbUserId } from '../utils/user-cache.js';
import { botApi } from '@moneyapp/api-client';
import { brl, escHtml } from '../utils/format.js';
import { Icons } from '../ui/icons.js';

/** Menu de relatórios de empréstimos. */
export async function showLoans(ctx: BotContext): Promise<void> {
  await ctx.reply(
    'Qual tipo de empréstimo você quer ver?',
    Markup.inlineKeyboard([
      [Markup.button.callback('A Receber', 'LOANS_given')],
      [Markup.button.callback('A Pagar', 'LOANS_received')],
    ]),
  );
}

export async function showLoanList(ctx: BotContext, type: 'given' | 'received'): Promise<void> {
  await ctx.answerCbQuery();
  
  const userId = await getDbUserId(ctx.from?.id);
  if (!userId) {
    await ctx.editMessageText('Seu usuário não está vinculado!');
    return;
  }

  const summary = await botApi.getLoansSummary(userId);
  const items = summary.items.filter(i => i.type === type).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const label = type === 'given' ? 'A Receber' : 'A Pagar';
  const total = type === 'given' ? summary.totalActiveAmountGiven : summary.totalActiveAmountReceived;

  if (items.length === 0) {
    await ctx.editMessageText(`Você não possui empréstimos ${label.toLowerCase()} ativos.`);
    return;
  }

  let msg = `${Icons.CalendarTitle} <b>Empréstimos ${label}</b>\n\n${Icons.Balances} <b>Total:</b> ${brl(total)}\n\n`;

  let currentMonthStr = '';
  for (const t of items) {
    const txMonth = t.date.slice(0, 7);
    if (txMonth !== currentMonthStr) {
      currentMonthStr = txMonth;
      const d = new Date(`${txMonth}-01T00:00:00Z`);
      const num = d.toLocaleDateString('pt-BR', { month: '2-digit', timeZone: 'UTC' });
      const name = d.toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' }).toUpperCase();
      msg += `\n${Icons.CalendarMonth} <b>MÊS ${num} • ${name}</b>\n`;
    }
    
    const dayNumStr = new Date(`${t.date.slice(0, 10)}T00:00:00Z`).toLocaleDateString('pt-BR', { day: '2-digit', timeZone: 'UTC' });
    const dayIcon = Icons.Days[dayNumStr as keyof typeof Icons.Days] || dayNumStr;
    
    let badge = `${Icons.Loan} `;

    msg += `${dayIcon} - ${badge}${escHtml(t.description)} <b>${brl(t.amount)}</b>\n`;
  }

  if (msg.length > 4000) {
    await ctx.editMessageText(`${Icons.CalendarTitle} <b>Empréstimos ${label}</b>\n\n${Icons.Balances} <b>Total:</b> ${brl(total)}\n\n(A lista é muito longa, exibindo apenas os primeiros...)`, { parse_mode: 'HTML' });
    const chunks = msg.match(/.{1,4000}/g) || [];
    for (const chunk of chunks) {
       await ctx.reply(chunk, { parse_mode: 'HTML' });
    }
  } else {
    await ctx.editMessageText(msg, { parse_mode: 'HTML' });
  }
}
