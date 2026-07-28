import { env } from '../config.js';

/**
 * Cliente das rotas de usuário do MoneyAPP (/transactions, /categories, …).
 * O bot é um chamador de serviço confiável: autentica com a BOT_SERVICE_KEY e
 * declara em nome de qual usuário está agindo via header `x-user-id`. Não há
 * mais JWT auto-assinado — a identidade do usuário é validada no LoginHub no
 * momento do /login e o telegram_id fica vinculado no backend.
 */
async function request<T>(method: string, path: string, loginhubId: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {
    'x-api-key': env.BOT_SERVICE_KEY,
    'x-user-id': loginhubId,
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${env.BACKEND_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

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
