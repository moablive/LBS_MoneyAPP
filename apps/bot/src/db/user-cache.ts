import { env } from '../config.js';
import { getUserIdByEmail } from './users.js';

/**
 * O bot atende um único usuário (USER_EMAIL), então o UUID é resolvido uma vez
 * e memoizado. Se a primeira tentativa falhar (banco fora do ar, por exemplo),
 * `cached` continua null e uma nova chamada tenta de novo.
 */
let cached: string | null = null;

export async function getDbUserId(): Promise<string | null> {
  if (cached) return cached;
  cached = await getUserIdByEmail(env.USER_EMAIL);
  return cached;
}
