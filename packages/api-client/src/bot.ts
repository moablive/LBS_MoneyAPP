import { apiOptions, ApiError } from './client.js';

export const botApi = {
  getUserIdByTelegramId: async (telegramId: string): Promise<{ id: string } | null> => {
    try {
      const res = await fetch(`${apiOptions.baseUrl}/bot/users/by-telegram/${telegramId}`, {
        headers: {
          'Authorization': `Bearer ${apiOptions.getToken() || ''}`,
        },
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
      return await res.json();
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  },

  getAllBotUsers: async (): Promise<{ id: string, email: string, telegramId: string }[]> => {
    const res = await fetch(`${apiOptions.baseUrl}/bot/users/all`, {
      headers: {
        'Authorization': `Bearer ${apiOptions.getToken() || ''}`,
      },
    });
    if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
    return await res.json();
  },

  login: async (email: string, password: string, telegramId: string): Promise<{ id: string } | null> => {
    try {
      const res = await fetch(`${apiOptions.baseUrl}/bot/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiOptions.getToken() || ''}`,
        },
        body: JSON.stringify({ email, password, telegramId }),
      });
      if (res.status === 401) return null;
      if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
      return await res.json();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return null;
      throw e;
    }
  },

  getSummaryByCategory: async (userId: string, type: 'income' | 'expense') => {
    const res = await fetch(`${apiOptions.baseUrl}/bot/summaries/by-category?userId=${userId}&type=${type}`, {
      headers: { 'Authorization': `Bearer ${apiOptions.getToken() || ''}` },
    });
    if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
    return await res.json();
  },

  getTransactionsByCategory: async (userId: string, categoryId: string) => {
    const res = await fetch(`${apiOptions.baseUrl}/bot/categories/${categoryId}/transactions?userId=${userId}`, {
      headers: { 'Authorization': `Bearer ${apiOptions.getToken() || ''}` },
    });
    if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
    return await res.json();
  },

  getAllSummaries: async (userId: string) => {
    const res = await fetch(`${apiOptions.baseUrl}/bot/summaries/all?userId=${userId}`, {
      headers: { 'Authorization': `Bearer ${apiOptions.getToken() || ''}` },
    });
    if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
    return await res.json();
  },

  getRecentTransactionsWithoutReceipt: async (userId: string, limit: number = 5) => {
    const res = await fetch(`${apiOptions.baseUrl}/bot/transactions/no-receipt?userId=${userId}&limit=${limit}`, {
      headers: { 'Authorization': `Bearer ${apiOptions.getToken() || ''}` },
    });
    if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
    return await res.json();
  },

  getDashboardSummary: async (userId: string) => {
    const res = await fetch(`${apiOptions.baseUrl}/bot/dashboard/summary?userId=${userId}`, {
      headers: { 'Authorization': `Bearer ${apiOptions.getToken() || ''}` },
    });
    if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
    return await res.json();
  },

  getCreditCardsSummary: async (userId: string): Promise<{ name: string; currentBalance: number; creditLimit: number | null }[]> => {
    const res = await fetch(`${apiOptions.baseUrl}/bot/dashboard/cards?userId=${userId}`, {
      headers: { 'Authorization': `Bearer ${apiOptions.getToken() || ''}` },
    });
    if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
    return await res.json();
  },

  createShareLink: async (userId: string, categoryId: string) => {
    const res = await fetch(`${apiOptions.baseUrl}/bot/shares`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiOptions.getToken() || ''}`,
      },
      body: JSON.stringify({ userId, categoryId }),
    });
    if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
    return await res.json() as { token: string; password: string };
  },
};


