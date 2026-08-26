import { env } from '../config.js';

/**
 * Cliente das rotas de usuario do MoneyAPP (/transactions, /categories, …).
 *
 * Duas identidades, escolhidas em tempo de execucao:
 *
 *  - FASE 2 (HUB_DELEGATION_KEY setado): o bot pede ao LoginHub um JWT de usuario
 *    CURTO (POST /auth/service/delegate, pela rede interna) e o repassa como
 *    `Authorization: Bearer <jwt>`. O backend valida pela guarda de sempre
 *    (assinatura, tenant, piso de revogacao) — nao ha mais `x-user-id` confiado
 *    cego. O bot nao guarda credencial de usuario; so cacheia o token curto.
 *
 *  - LEGADO (sem a chave): `x-api-key: BOT_SERVICE_KEY` + `x-user-id`. Mantido
 *    enquanto a fase 2 nao estiver ligada, para nao quebrar nada na transicao.
 */

// Token delegado por usuario. Curto de proposito; guardamos ate um pouco antes
// de expirar para nao ir a rede a cada chamada.
const tokenCache = new Map<string, { token: string; expiraEm: number }>();

async function obterTokenDelegado(loginhubId: string): Promise<string | null> {
  if (!env.HUB_DELEGATION_KEY) return null; // fase 2 desligada -> legado
  const agora = Date.now();
  const cacheado = tokenCache.get(loginhubId);
  if (cacheado && cacheado.expiraEm > agora + 15_000) return cacheado.token;
  try {
    const res = await fetch(`${env.LOGINHUB_API_URL}/auth/service/delegate`, {
      method: 'POST',
      headers: { 'x-service-key': env.HUB_DELEGATION_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: loginhubId }),
    });
    if (!res.ok) {
      console.error(`[bot] delegacao falhou (${res.status}) para ${loginhubId}; usando legado`);
      return null;
    }
    const data = (await res.json()) as { token: string; expiresIn?: number };
    tokenCache.set(loginhubId, { token: data.token, expiraEm: agora + (data.expiresIn ?? 600) * 1000 });
    return data.token;
  } catch (e) {
    console.error('[bot] erro ao obter token delegado; usando legado:', (e as Error).message);
    return null;
  }
}

async function request<T>(method: string, path: string, loginhubId: string, body?: unknown, jaTentou = false): Promise<T> {
  const headers: Record<string, string> = {};
  const token = await obterTokenDelegado(loginhubId);
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else {
    headers['x-api-key'] = env.BOT_SERVICE_KEY;
    headers['x-user-id'] = loginhubId;
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${env.BACKEND_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  // Token delegado pode ter expirado na janela: invalida e tenta uma vez.
  if (res.status === 401 && token && !jaTentou) {
    tokenCache.delete(loginhubId);
    return request<T>(method, path, loginhubId, body, true);
  }

  if (!res.ok) {
    let errBody = null;
    try { errBody = await res.json(); } catch {}
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(errBody)}`);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const userApi = {
  get: <T>(path: string, loginhubId: string) => request<T>('GET', path, loginhubId),
  post: <T>(path: string, loginhubId: string, body?: unknown) => request<T>('POST', path, loginhubId, body),
  patch: <T>(path: string, loginhubId: string, body?: unknown) => request<T>('PATCH', path, loginhubId, body),
};
