/**
 * Venda do MoneyAPP por assinatura mensal.
 *
 * Quem cuida da venda é o LoginHUB (preço, afiliados, assinantes): estas são as
 * rotas PÚBLICAS dele (`/venda/...`), sem sessão, porque quem compra ainda não
 * tem conta. O pagamento é no Mercado Pago, cartão automático todo mês.
 */

// Mesmo fallback do stores/auth.ts: build arg ausente não pode virar path relativo.
const LOGINHUB_API =
  (import.meta.env.VITE_LOGINHUB_API_URL as string) || 'https://loginhub.astralwavelabel.com/api';
const APP_ID = (import.meta.env.VITE_LOGINHUB_APP_ID as string | undefined) || '3';

export interface PlanoPublico {
  app_id: number;
  app_nome: string;
  valor: number;
  descricao: string;
  /** Nome do afiliado quando o `?ref=` do link existe e está ativo. */
  afiliado?: string | null;
}

export type StatusAssinatura = 'iniciada' | 'ativa' | 'pausada' | 'cancelada';

export class ErroDeVenda extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function chamar<T>(caminho: string, init?: RequestInit): Promise<T> {
  let resposta: Response;
  try {
    resposta = await fetch(`${LOGINHUB_API}${caminho}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ErroDeVenda('Sem conexão. Confira a internet e tente de novo.', 0);
  }
  const corpo = (await resposta.json().catch(() => ({}))) as { message?: string };
  if (!resposta.ok) throw new ErroDeVenda(corpo.message || 'Não foi possível concluir. Tente de novo.', resposta.status);
  return corpo as T;
}

export const buscarPlano = (ref?: string | null) =>
  chamar<PlanoPublico>(`/venda/apps/${APP_ID}/plano${ref ? `?ref=${encodeURIComponent(ref)}` : ''}`);

/** Abre a assinatura e devolve a página do Mercado Pago onde se cadastra o cartão. */
export const assinar = (dados: { nome: string; email: string; telefone?: string; ref?: string | null }) =>
  chamar<{ url: string; ref: string }>(`/venda/apps/${APP_ID}/assinar`, { method: 'POST', body: JSON.stringify(dados) });

export const consultarPedido = (pedido: string) =>
  chamar<{ status: StatusAssinatura; email: string; acesso_liberado: boolean }>(`/venda/assinaturas/${encodeURIComponent(pedido)}`);

// ── Afiliado ────────────────────────────────────────────────────────────────
// O `?ref=` do link fica guardado por 30 dias: quem chega pelo afiliado, sai e
// volta depois direto no endereço ainda conta como indicação dele.
const CHAVE_REF = 'moneyapp.afiliado';
const VALIDADE_REF_MS = 30 * 24 * 60 * 60 * 1000;

export function guardarAfiliado(ref: string): void {
  try {
    localStorage.setItem(CHAVE_REF, JSON.stringify({ ref, em: Date.now() }));
  } catch {
    /* navegação privada: vale só para esta visita */
  }
}

export function afiliadoGuardado(): string | null {
  try {
    const bruto = localStorage.getItem(CHAVE_REF);
    if (!bruto) return null;
    const { ref, em } = JSON.parse(bruto) as { ref?: string; em?: number };
    if (!ref || !em || Date.now() - em > VALIDADE_REF_MS) return null;
    return ref;
  } catch {
    return null;
  }
}

export const dinheiro = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
