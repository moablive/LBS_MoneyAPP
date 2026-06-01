import { defineStore } from 'pinia';
import { ref } from 'vue';
import { investmentsApi, type Investment, type InvestmentSummary, type CreateInvestmentPayload } from '@moneyapp/shared';

export const useInvestmentsStore = defineStore('investments', () => {
  const items = ref<Investment[]>([]);
  const summary = ref<InvestmentSummary>({
    totalInvested: 0,
    currentTotal: 0,
    profitLoss: 0,
    percentage: 0,
    assetCount: 0,
  });
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const fetchInvestments = async () => {
    isLoading.value = true;
    error.value = null;
    try {
      const [itemsRes, summaryRes] = await Promise.all([
        investmentsApi.getAll(),
        investmentsApi.getSummary(),
      ]);
      items.value = itemsRes;
      summary.value = summaryRes;
    } catch (err: any) {
      error.value = err.body?.error || 'Failed to load investments';
    } finally {
      isLoading.value = false;
    }
  };

  const createInvestment = async (data: CreateInvestmentPayload) => {
    try {
      await investmentsApi.create(data);
      await fetchInvestments();
    } catch (err: any) {
      throw new Error(err.body?.error || 'Failed to create investment');
    }
  };

  const updateInvestment = async (id: string, data: Partial<CreateInvestmentPayload>) => {
    try {
      await investmentsApi.update(id, data);
      await fetchInvestments();
    } catch (err: any) {
      throw new Error(err.body?.error || 'Failed to update investment');
    }
  };

  const deleteInvestment = async (id: string) => {
    try {
      await investmentsApi.delete(id);
      await fetchInvestments();
    } catch (err: any) {
      throw new Error(err.body?.error || 'Failed to delete investment');
    }
  };

  const depositToPiggyBank = async (id: string, amount: number, accountId?: string) => {
    try {
      await investmentsApi.deposit(id, amount, accountId);
      await fetchInvestments();
    } catch (err: any) {
      throw new Error(err.body?.error || 'Failed to deposit');
    }
  };

  const withdrawFromPiggyBank = async (id: string, amount: number, accountId?: string) => {
    try {
      await investmentsApi.withdraw(id, amount, accountId);
      await fetchInvestments();
    } catch (err: any) {
      throw new Error(err.body?.error || 'Failed to withdraw');
    }
  };

  return {
    items,
    summary,
    isLoading,
    error,
    fetchInvestments,
    createInvestment,
    updateInvestment,
    deleteInvestment,
    depositToPiggyBank,
    withdrawFromPiggyBank,
  };
});
