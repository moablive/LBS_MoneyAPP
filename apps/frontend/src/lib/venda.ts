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
  /** Comissão de quem se cadastra como afiliado pela página (% de cada mensalidade). */
  comissao_afiliado_pct?: number;
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

/**
 * Botão "link de afiliado": cadastra a pessoa no LoginHUB e devolve o link dela.
 * Quem repete o formulário com o mesmo e-mail recebe o link que já tinha.
 */
export const cadastrarAfiliado = (dados: { nome: string; email: string; telefone: string; documento: string }) =>
  chamar<{ codigo: string; link: string; comissao_pct: number; ja_existia: boolean }>(`/venda/apps/${APP_ID}/afiliados`, {
    method: 'POST',
    body: JSON.stringify(dados),
  });

export const consultarPedido = (pedido: string) =>
  chamar<{ status: StatusAssinatura; email: string; acesso_liberado: boolean }>(`/venda/assinaturas/${encodeURIComponent(pedido)}`);

// ── Cliente (cadastro no banco do MoneyAPP) ─────────────────────────────────
// O formulário grava nome, e-mail, WhatsApp e CPF ou CNPJ em `clientes` ANTES
// de abrir o Mercado Pago, e de novo com o `pedido` quando o checkout abre.
const BACKEND_API = (import.meta.env.VITE_API_BASE_URL as string) || '/api';

export async function salvarCliente(dados: {
  nome: string;
  email: string;
  telefone?: string;
  documento: string;
  afiliado?: string | null;
  pedido?: string;
}): Promise<void> {
  let resposta: Response;
  try {
    resposta = await fetch(`${BACKEND_API}/clientes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados),
    });
  } catch {
    throw new ErroDeVenda('Sem conexão. Confira a internet e tente de novo.', 0);
  }
  if (!resposta.ok) {
    const corpo = (await resposta.json().catch(() => ({}))) as { message?: string };
    throw new ErroDeVenda(corpo.message || 'Confira os dados e tente de novo.', resposta.status);
  }
}

// ── CPF / CNPJ ──────────────────────────────────────────────────────────────
// A mesma conferência dos dígitos verificadores que o backend faz
// (apps/backend/src/routes/clientes.ts); aqui é só para avisar antes de enviar.
const repetido = (d: string) => /^(\d)\1+$/.test(d);

function cpfValido(d: string): boolean {
  if (d.length !== 11 || repetido(d)) return false;
  const digito = (ate: number) => {
    let soma = 0;
    for (let i = 0; i < ate; i++) soma += Number(d[i]) * (ate + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(9) === Number(d[9]) && digito(10) === Number(d[10]);
}

function cnpjValido(d: string): boolean {
  if (d.length !== 14 || repetido(d)) return false;
  const digito = (ate: number) => {
    const pesos = ate === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let soma = 0;
    for (let i = 0; i < ate; i++) soma += Number(d[i]) * pesos[i]!;
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return digito(12) === Number(d[12]) && digito(13) === Number(d[13]);
}

export function documentoValido(texto: string): boolean {
  const d = texto.replace(/\D/g, '');
  return d.length === 14 ? cnpjValido(d) : cpfValido(d);
}

/** "12345678909" → "123.456.789-09"; com 12+ dígitos vira CNPJ "12.345.678/0001-95". */
export function mascararDocumento(texto: string): string {
  const d = texto.replace(/\D/g, '').slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
  }
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

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
