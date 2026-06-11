import { Markup } from 'telegraf';
import type { InlineKeyboardButton } from 'telegraf/types';

import { Icons } from './icons.js';

export function mainMenuKeyboard() {
  return Markup.keyboard([
    [`${Icons.Dashboard} Dashboard`, `${Icons.Cards} Cartões`],
    [`${Icons.NewRecord} Registrar Novo`, `${Icons.Receipt} Anexar Comprovante`],
    [`${Icons.Category} Ver Categoria`, `${Icons.Reports} Ver Relatórios`],
    [`${Icons.GeneralReport} Relatório Geral`, `${Icons.Balances} Saldos das Contas`],
    [`${Icons.Upcoming} Próximos Lançamentos`, `${Icons.Loans} Empréstimos`],
  ]).resize();
}

/**
 * Monta um InlineKeyboard com as categorias (2 por linha), usando o id da
 * categoria como callback_data — exatamente como o bot original em Python.
 */
export function categoryKeyboard(cats: ReadonlyArray<{ id: string; name: string }>) {
  const rows: InlineKeyboardButton[][] = [];
  let row: InlineKeyboardButton[] = [];
  for (const cat of cats) {
    row.push(Markup.button.callback(cat.name, cat.id));
    if (row.length === 2) {
      rows.push(row);
      row = [];
    }
  }
  if (row.length) rows.push(row);
  return Markup.inlineKeyboard(rows);
}

/**
 * Monta um InlineKeyboard com as contas (2 por linha).
 */
export function accountKeyboard(accounts: ReadonlyArray<{ id: string; name: string }>) {
  const rows: InlineKeyboardButton[][] = [];
  let row: InlineKeyboardButton[] = [];
  for (const acc of accounts) {
    row.push(Markup.button.callback(acc.name, acc.id));
    if (row.length === 2) {
      rows.push(row);
      row = [];
    }
  }
  if (row.length) rows.push(row);
  return Markup.inlineKeyboard(rows);
}
