// Nível do limite LIVRE do cartão (05/11/2026, pedido do dono): a cor da barra e do cartão
// acompanha o que ainda dá para gastar — vermelho até 20% livre, amarelo até 50%, verde acima.
export type NivelLimite = 'verde' | 'amarelo' | 'vermelho';

export function pctLivre(usado: number | string, limite: number | string): number | null {
  const lim = Number(limite);
  if (!lim || lim <= 0) return null;
  return Math.min(100, Math.max(0, ((lim - Math.abs(Number(usado))) / lim) * 100));
}

export function nivelLimite(usado: number | string, limite: number | string): NivelLimite | null {
  const pct = pctLivre(usado, limite);
  if (pct === null) return null;
  if (pct <= 20) return 'vermelho';
  if (pct <= 50) return 'amarelo';
  return 'verde';
}

// Fundo dos cartões nas listas (tela Cartões e seção Cartões de Contas): tinta leve do nível.
const fundos: Record<NivelLimite, string> = {
  verde: 'bg-emerald-500/10 border-emerald-500/35',
  amarelo: 'bg-amber-400/15 border-amber-400/45',
  vermelho: 'bg-red-500/10 border-red-500/40',
};

export function fundoCartao(usado: number | string, limite: number | string): string {
  const nivel = nivelLimite(usado, limite);
  return nivel ? fundos[nivel] : 'bg-surface-raised border-surface-border';
}
