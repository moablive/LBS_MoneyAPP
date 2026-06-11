import type { BotContext } from '../context.js';
import { getDbUserId } from '../db/user-cache.js';
import { getDashboardSummary, getCreditCardsSummary } from '../db/dashboard.js';
import { getAllSummaries } from '../db/transactions.js';
import { brl } from '../utils/format.js';

export async function showDashboard(ctx: BotContext): Promise<void> {
  const userId = await getDbUserId(ctx.from?.id);
  if (!userId) {
    await ctx.reply('Seu usuário não está vinculado!');
    return;
  }

  const summaries = await getAllSummaries(userId);
  const dashboard = await getDashboardSummary(userId);

  let totalReceitas = 0;
  let totalDespesas = 0;

  for (const row of summaries) {
    if (row.type === 'income') {
      totalReceitas += row.total;
    } else {
      totalDespesas += row.total;
    }
  }

  const msg = `🌐 <b>Dashboard Geral</b>\n\n` +
    `💰 <b>Saldo Atual:</b> ${brl(dashboard.currentBalance)}\n` +
    `📈 <b>Receitas do Mês:</b> ${brl(totalReceitas)}\n` +
    `📉 <b>Despesas do Mês:</b> ${brl(totalDespesas)}\n\n` +
    `<i>Balanço do Mês: ${brl(totalReceitas - totalDespesas)}</i>`;

  await ctx.reply(msg, { parse_mode: 'HTML' });
}

export async function showCards(ctx: BotContext): Promise<void> {
  const userId = await getDbUserId(ctx.from?.id);
  if (!userId) {
    await ctx.reply('Seu usuário não está vinculado!');
    return;
  }

  const cards = await getCreditCardsSummary(userId);

  if (cards.length === 0) {
    await ctx.reply('Você não possui cartões de crédito cadastrados.');
    return;
  }

  let msg = `💳 <b>Meus Cartões</b>\n\n`;
  let totalFaturas = 0;

  for (const card of cards) {
    // Para cartões de crédito, o saldo (currentBalance) geralmente representa a fatura atual
    totalFaturas += card.currentBalance;
    const limitInfo = card.creditLimit !== null ? ` (Limite: ${brl(card.creditLimit)})` : '';
    msg += `• <b>${card.name}</b>\n  Fatura Atual: ${brl(card.currentBalance)}${limitInfo}\n\n`;
  }

  msg += `<b>Total em Faturas:</b> ${brl(totalFaturas)}`;

  await ctx.reply(msg, { parse_mode: 'HTML' });
}
