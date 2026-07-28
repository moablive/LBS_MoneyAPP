import { api, apiOptions } from './client.js';

export const sharesClient = {
  createShareLink: async (categoryId?: string | null) => {
    return api.post<{ token: string; password: string }>('/shares', { categoryId });
  },

  verifyShareLink: async (token: string, password: string) => {
    return api.post<{ token: string }>(`/shares/${token}/verify`, { password });
  },

  getSharedTransactions: async (token: string, sessionToken: string) => {
    try {
      const response = await fetch(`${apiOptions.baseUrl}/shares/${token}/transactions`, {
        headers: {
          'Authorization': `Bearer ${sessionToken}`
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch shared transactions');
      }
      return await response.json() as import('@moneyapp/models').Transaction[];
    } catch (e) {
      throw e;
    }
  },

  getSharedTransactionReceipt: async (token: string, transactionId: string, sessionToken: string) => {
    const response = await fetch(`${apiOptions.baseUrl}/shares/${token}/transactions/${transactionId}/receipt`, {
      headers: {
        'Authorization': `Bearer ${sessionToken}`
      }
    });
    if (!response.ok) {
      throw new Error('Failed to fetch receipt');
    }
    const blob = await response.blob();
    return { url: URL.createObjectURL(blob), type: blob.type };
  },
};
