import { botApi } from '@moneyapp/api-client';

const cache = new Map<string, string>();

export async function getDbUserId(telegramId?: number): Promise<string | null> {
  if (!telegramId) return null;
  const tid = String(telegramId);
  
  if (cache.has(tid)) {
    return cache.get(tid)!;
  }
  
  const user = await botApi.getUserIdByTelegramId(tid);
  if (user?.id) {
    cache.set(tid, user.id);
    return user.id;
  }
  
  return null;
}
