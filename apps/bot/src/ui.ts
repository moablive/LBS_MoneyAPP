import { Markup } from 'telegraf';
import type { InlineKeyboardButton } from 'telegraf/types';

export function mainMenuKeyboard() {
  return Markup.keyboard([
    ['📝 Registrar Novo', '📎 Anexar Comprovante'],
    ['🔍 Ver Categoria', '📊 Ver Relatórios'],
    ['📄 Relatório Geral'],
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
