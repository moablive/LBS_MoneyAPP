import { botApi } from '@moneyapp/api-client';
import fs from 'fs';
import path from 'path';

const cache = new Map<string, string>();
const NOTIFICATIONS_FILE = path.join(process.cwd(), 'disabled-notifications.json');

export function getDisabledNotifications(): Set<string> {
  try {
    if (fs.existsSync(NOTIFICATIONS_FILE)) {
      const data = fs.readFileSync(NOTIFICATIONS_FILE, 'utf-8');
      return new Set(JSON.parse(data));
    }
  } catch (e) {
    console.error(e);
  }
  return new Set();
}

export function toggleNotification(telegramId: string): boolean {
  const disabled = getDisabledNotifications();
  let isNowEnabled = false;
  if (disabled.has(telegramId)) {
    disabled.delete(telegramId);
    isNowEnabled = true;
  } else {
    disabled.add(telegramId);
    isNowEnabled = false;
  }
  fs.writeFileSync(NOTIFICATIONS_FILE, JSON.stringify(Array.from(disabled)), 'utf-8');
  return isNowEnabled;
}

export function isNotificationEnabled(telegramId: string): boolean {
  const disabled = getDisabledNotifications();
  return !disabled.has(telegramId);
}

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
