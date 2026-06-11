/** Formata um valor como o bot original: "R$ 150.50". */
export function brl(value: number): string {
  return `R$ ${value.toFixed(2)}`;
}

/** Escapa texto para uso seguro com parse_mode HTML do Telegram. */
export function escHtml(text: string): string {
  return text.replace(/[&<>]/g, (c) => (c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'));
}

/** Data no formato dd/mm/aaaa no fuso de São Paulo. */
const dateFmt = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'America/Sao_Paulo',
});

export function dmy(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return dateFmt.format(d);
}
