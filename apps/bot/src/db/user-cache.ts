import { getUserIdByTelegramId } from './users.js';

const cache = new Map<string, string>();

export async function getDbUserId(telegramId?: number): Promise<string | null> {
  if (!telegramId) return null;
  const tid = String(telegramId);
  
  if (cache.has(tid)) {
    return cache.get(tid)!;
  }
  
  const userId = await getUserIdByTelegramId(tid);
  if (userId) {
    cache.set(tid, userId);
  }
  
  return userId;
}
