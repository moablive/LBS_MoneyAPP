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
   * Vincula a conta do Telegram a um usuário do MoneyAPP. As credenciais são
   * validadas NO LOGINHUB (identidade central) e só então o telegram_id é
   * gravado no backend do MoneyAPP. Retorna null para credenciais inválidas e
   * lança ApiError(403, { error: 'needs_password_change' }) quando o usuário
   * ainda usa a senha temporária (deve trocá-la no painel web antes).
   */
  login: async (email: string, password: string, telegramId: string): Promise<{ id: string } | null> => {
    // 1) Valida e-mail + senha no LoginHub.
    // Envia app_id para evitar AMBIGUOUS_EMAIL (mesmo e-mail em vários apps).
    const loginBody: { email: string; password: string; app_id?: string } = { email, password };
    if (apiOptions.loginhubAppId) loginBody.app_id = apiOptions.loginhubAppId;

    let lh: Response;
    try {
      lh = await fetch(`${apiOptions.loginhubUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginBody),
      });
    } catch {
      throw new ApiError(0, { error: 'loginhub_unreachable' });
    }
    if (lh.status === 401) return null; // credenciais inválidas
    // 409 = e-mail vinculado a múltiplos apps sem app_id. Não deve ocorrer com
    // LOGINHUB_APP_ID configurado, mas tratamos para não cair no erro genérico.
    if (lh.status === 409) throw new ApiError(409, { error: 'ambiguous_email' });
    if (!lh.ok) throw new ApiError(lh.status, await lh.json().catch(() => null));

    const data = (await lh.json()) as {
      requirePasswordChange?: boolean;
      usuario?: { nome?: string; id?: number };
    };

    if (data.requirePasswordChange) {
      throw new ApiError(403, { error: 'needs_password_change' });
    }

    // 2) Vincula o telegram_id ao usuário no MoneyAPP (chamada de serviço).
    const link = await fetch(`${apiOptions.baseUrl}/bot/link-telegram`, {
      method: 'POST',
      headers: serviceHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ loginhubId: data.usuario?.id?.toString(), email, telegramId }),
    });
    if (!link.ok) throw new ApiError(link.status, await link.json().catch(() => null));
    return (await link.json()) as { id: string };
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
