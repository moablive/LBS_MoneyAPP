import { env } from '../config.js';
import jwt from 'jsonwebtoken';

function generateToken(userId: string): string {
  // Gera um token válido por 5 minutos, o suficiente para a requisição
  return jwt.sign({ sub: userId, email: 'bot@moneyapp.internal' }, env.JWT_SECRET, { expiresIn: '5m' });
}

async function request<T>(method: string, path: string, userId: string, body?: unknown): Promise<T> {
  const token = generateToken(userId);
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${token}`
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
  get: <T>(path: string, userId: string) => request<T>('GET', path, userId),
  post: <T>(path: string, userId: string, body?: unknown) => request<T>('POST', path, userId, body),
  patch: <T>(path: string, userId: string, body?: unknown) => request<T>('PATCH', path, userId, body),
};
