import { apiOptions, serviceHeaders, ApiError } from './client.js';

export const botApi = {
  getUserIdByTelegramId: async (telegramId: string): Promise<{ id: string } | null> => {
    try {
      const res = await fetch(`${apiOptions.baseUrl}/bot/users/by-telegram/${telegramId}`, {
        headers: serviceHeaders(),
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
      return await res.json();
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  },

  getAllBotUsers: async (): Promise<{ id: string, email: string, telegramId: string, displayName?: string | null }[]> => {
    const res = await fetch(`${apiOptions.baseUrl}/bot/users/all`, {
      headers: serviceHeaders(),
    });
    if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
    return await res.json();
  },

  /**
   * Vincula a conta do Telegram a um usuário do MoneyAPP.
   *
   * Chamada de SERVIÇO: quem provou a identidade foi o LoginHub, na cena de
   * login, pelo `auth-kit`. O login do hub morava aqui dentro e conhecia por
   * conta própria as rotas e os desfechos do `/auth/login` — fork do contrato,
   * exatamente o que o kit existe para evitar. Este cliente voltou a fazer só o
   * que é dele: falar com o backend do MoneyAPP.
   */
  linkTelegram: async (loginhubId: number, email: string, telegramId: string): Promise<{ id: string }> => {
    const res = await fetch(`${apiOptions.baseUrl}/bot/link-telegram`, {
      method: 'POST',
      headers: serviceHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ loginhubId: String(loginhubId), email, telegramId }),
    });
    if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
    return (await res.json()) as { id: string };
  },

  getSummaryByCategory: async (loginhubId: string, type: 'income' | 'expense') => {
    const res = await fetch(`${apiOptions.baseUrl}/bot/summaries/by-category?loginhubId=${loginhubId}&type=${type}`, {
      headers: serviceHeaders(),
    });
    if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
    return await res.json();
  },

  getTransactionsByCategory: async (loginhubId: string, categoryId: string) => {
    const res = await fetch(`${apiOptions.baseUrl}/bot/categories/${categoryId}/transactions?loginhubId=${loginhubId}`, {
      headers: serviceHeaders(),
    });
    if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
    return await res.json();
  },

  getAllSummaries: async (loginhubId: string) => {
    const res = await fetch(`${apiOptions.baseUrl}/bot/summaries/all?loginhubId=${loginhubId}`, {
      headers: serviceHeaders(),
    });
    if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
    return await res.json();
  },

  getRecentTransactionsWithoutReceipt: async (loginhubId: string, limit: number = 5) => {
    const res = await fetch(`${apiOptions.baseUrl}/bot/transactions/no-receipt?loginhubId=${loginhubId}&limit=${limit}`, {
      headers: serviceHeaders(),
    });
    if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
    return await res.json();
  },

  getDashboardSummary: async (loginhubId: string) => {
    const res = await fetch(`${apiOptions.baseUrl}/bot/dashboard/summary?loginhubId=${loginhubId}`, {
      headers: serviceHeaders(),
    });
    if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
    return await res.json();
  },

  getAccountsSummary: async (loginhubId: string): Promise<{ name: string; currentBalance: number }[]> => {
    const res = await fetch(`${apiOptions.baseUrl}/bot/dashboard/accounts?loginhubId=${loginhubId}`, {
      headers: serviceHeaders(),
    });
    if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
    return await res.json();
  },

  getCreditCardsSummary: async (loginhubId: string): Promise<{ name: string; currentBalance: number; creditLimit: number | null }[]> => {
    const res = await fetch(`${apiOptions.baseUrl}/bot/dashboard/cards?loginhubId=${loginhubId}`, {
      headers: serviceHeaders(),
    });
    if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
    return await res.json();
  },

  createShareLink: async (loginhubId: string, categoryId: string) => {
    const res = await fetch(`${apiOptions.baseUrl}/bot/shares`, {
      method: 'POST',
      headers: serviceHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ loginhubId, categoryId }),
    });
    if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
    return await res.json() as { token: string; password: string };
  },

  getLoansSummary: async (loginhubId: string): Promise<{
    totalActiveAmountGiven: number;
    totalActiveAmountReceived: number;
    totalActiveAmountFGTS: number;
    items: any[];
  }> => {
    const res = await fetch(`${apiOptions.baseUrl}/bot/loans/summary?loginhubId=${loginhubId}`, {
      headers: serviceHeaders(),
    });
    if (!res.ok) throw new ApiError(res.status, await res.json().catch(() => null));
    return await res.json();
  },
};
