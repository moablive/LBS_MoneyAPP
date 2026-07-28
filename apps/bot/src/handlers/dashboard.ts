import type { BotContext } from '../context.js';
import { getDbUserId } from '../utils/user-cache.js';
import { botApi } from '@moneyapp/api-client';
import { brl } from '../utils/format.js';

export async function showDashboard(ctx: BotContext): Promise<void> {
  const loginhubId = await getDbUserId(ctx.from?.id);
  if (!loginhubId) {
    await ctx.reply('Seu usuário não está vinculado!');
    return;
  }

  const summaries = await botApi.getAllSummaries(loginhubId);
  const dashboard = await botApi.getDashboardSummary(loginhubId);

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
  const loginhubId = await getDbUserId(ctx.from?.id);
  if (!loginhubId) {
    await ctx.reply('Seu usuário não está vinculado!');
    return;
  }

  const cards = await botApi.getCreditCardsSummary(loginhubId);

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

import { renderChartPng } from '../utils/chart.js';

export async function showBalances(ctx: BotContext): Promise<void> {
  const loginhubId = await getDbUserId(ctx.from?.id);
  if (!loginhubId) {
    await ctx.reply('Seu usuário não está vinculado!');
    return;
  }

  const accounts = await botApi.getAccountsSummary(loginhubId);

  if (accounts.length === 0) {
    await ctx.reply('Você não possui contas cadastradas.');
    return;
  }

  const png = await renderChartPng(
    accounts.map((acc: any) => ({ name: acc.name, value: acc.currentBalance })),
    'Saldos das Contas'
  );

  if (!png) {
    await ctx.reply('Nenhuma conta com saldo positivo ou zerado para exibir no momento.');
    return;
  }

  await ctx.replyWithPhoto({ source: png }, { caption: `Aqui estão os saldos das suas contas.` });
}
