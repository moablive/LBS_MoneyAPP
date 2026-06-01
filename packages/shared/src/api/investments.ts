import { api } from './client';

import type { Investment, InvestmentSummary, CreateInvestmentPayload } from '../schema/investment';
export type { Investment, InvestmentSummary, CreateInvestmentPayload };

export const investmentsApi = {
  getAll: () => api.get<Investment[]>('/investments'),
  getSummary: () => api.get<InvestmentSummary>('/investments/summary'),
  create: (data: CreateInvestmentPayload) => api.post<Investment>('/investments', data),
  update: (id: string, data: Partial<CreateInvestmentPayload>) => api.put<Investment>(`/investments/${id}`, data),
  delete: (id: string) => api.delete<void>(`/investments/${id}`),
  getChart: (id: string) => api.get<{ chart: any[], currentBalance: number, yieldTotal: number }>(`/investments/${id}/chart`),
  deposit: (id: string, amount: number, accountId?: string) => api.post<void>(`/investments/${id}/deposit`, { amount, accountId }),
  withdraw: (id: string, amount: number, accountId?: string) => api.post<void>(`/investments/${id}/withdraw`, { amount, accountId }),
};
