import { Markup } from 'telegraf';
import type { BotContext } from '../context.js';
import { getDbUserId } from '../db/user-cache.js';
import { getSummaryByCategory, getAllSummaries } from '../db/transactions.js';
import { renderPieChartPng } from '../utils/pieChart.js';
import { brl, escHtml } from '../utils/format.js';

/** Menu de relatórios visuais (receitas/despesas). */
export async function showReports(ctx: BotContext): Promise<void> {
  await ctx.reply(
    'Qual relatório você quer ver?',
    Markup.inlineKeyboard([
      [Markup.button.callback('Gráfico de Receitas', 'REL_income')],
      [Markup.button.callback('Gráfico de Despesas', 'REL_expense')],
    ]),
  );
}

/** Gera e envia o gráfico de pizza (receitas ou despesas). */
export async function generateReportChart(ctx: BotContext, type: 'income' | 'expense'): Promise<void> {
  await ctx.answerCbQuery();

  const userId = await getDbUserId(ctx.from?.id);
  if (!userId) {
    await ctx.editMessageText('Seu usuário não está vinculado!');
    return;
  }

  const label = type === 'income' ? 'Receita' : 'Despesa';
  const data = await getSummaryByCategory(userId, type);
  if (data.length === 0) {
    await ctx.editMessageText(`Não há ${label.toLowerCase()}s registradas ainda.`);
    return;
  }

  const png = await renderPieChartPng(
    data.map((d) => ({ name: d.name, value: d.total, color: d.color })),
    `Relatório de ${label}`,
  );
  if (!png) {
    await ctx.editMessageText('Erro ao gerar o gráfico.');
    return;
  }

  await ctx.replyWithPhoto({ source: png }, { caption: `Aqui está seu gráfico de ${label}` });
}

/** Relatório textual do mês corrente (receitas, despesas e saldo). */
export async function generateTextReport(ctx: BotContext): Promise<void> {
  const userId = await getDbUserId(ctx.from?.id);
  if (!userId) {
    await ctx.reply('Seu usuário não está vinculado!');
    return;
  }

  const summaries = await getAllSummaries(userId);

  const header = `👤 <b>Relatório Geral (Mês Atual)</b>\n\n`;
  if (summaries.length === 0) {
    await ctx.reply(`${header}Você não possui movimentações neste mês.`, { parse_mode: 'HTML' });
    return;
  }

  const receitas: string[] = [];
  const despesas: string[] = [];
  let totalReceitas = 0;
  let totalDespesas = 0;

  for (const row of summaries) {
    if (row.type === 'income') {
      receitas.push(`🟢 ${escHtml(row.name)}: ${brl(row.total)}`);
      totalReceitas += row.total;
    } else {
      despesas.push(`🔴 ${escHtml(row.name)}: ${brl(row.total)}`);
      totalDespesas += row.total;
    }
  }

  let msg = header;
  if (receitas.length) {
    msg += `📈 <b>RECEITAS</b>\n${receitas.join('\n')}\n<i>Total Receitas: ${brl(totalReceitas)}</i>\n\n`;
  }
  if (despesas.length) {
    msg += `📉 <b>DESPESAS</b>\n${despesas.join('\n')}\n<i>Total Despesas: ${brl(totalDespesas)}</i>\n\n`;
  }
  msg += `💰 <b>SALDO DO MÊS:</b> ${brl(totalReceitas - totalDespesas)}`;

  await ctx.reply(msg, { parse_mode: 'HTML' });
}
