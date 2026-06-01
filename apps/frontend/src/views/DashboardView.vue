<script setup lang="ts">
import { computed, onMounted, ref, defineAsyncComponent, onUnmounted } from 'vue';
import { api } from '@moneyapp/api-client';
import AppShell from '../components/AppShell.vue';
import DashboardKPIs from '../components/dashboard/DashboardKPIs.vue';
import DashboardAccounts from '../components/dashboard/DashboardAccounts.vue';
import DashboardCreditCards from '../components/dashboard/DashboardCreditCards.vue';
import DashboardCategories from '../components/dashboard/DashboardCategories.vue';
import DashboardUpcoming from '../components/dashboard/DashboardUpcoming.vue';
import type { CategoryRankingResponse, DashboardSummaryResponse } from '@moneyapp/models';

// Lazy-load the modal so it's not in the initial bundle
const NewAccountModal = defineAsyncComponent(() => import('../components/NewAccountModal.vue'));

const summary = ref<DashboardSummaryResponse | null>(null);
const ranking = ref<CategoryRankingResponse | null>(null);
const accounts = ref<any[]>([]);
const subscriptionsSummary = ref<any | null>(null);
const upcomingTransactions = ref<any[]>([]);
const categories = ref<any[]>([]);
const loading = ref(true);
const showEditAccount = ref(false);
const editingAccount = ref<any | null>(null);
const showCreate = ref(false);
const createType = ref<'expense' | 'income'>('expense');

const categoriesMap = computed(() => {
  return new Map(categories.value.map(c => [c.id, c]));
});

function editAccount(acc: any) {
  editingAccount.value = acc;
  showEditAccount.value = true;
}

function handleCloseAccount() {
  showEditAccount.value = false;
  editingAccount.value = null;
}

const loadData = async () => {
  loading.value = true;
  try {
    const fromDate = new Date();
    fromDate.setHours(0, 0, 0, 0);

    const toDate = new Date(fromDate);
    toDate.setMonth(toDate.getMonth() + 1);
    toDate.setHours(23, 59, 59, 999);
    
    const fromParam = fromDate.toISOString();
    const toParam = toDate.toISOString();

    const [summaryRes, rankingRes, accountsRes, subscriptionsRes, transactionsRes, categoriesRes, loansRes] = await Promise.all([
      api.get<DashboardSummaryResponse>('/dashboard/summary'),
      api.get<CategoryRankingResponse>('/dashboard/categories/ranking?type=expense&includeZero=true'),
      api.get<any[]>('/accounts'),
      api.get<any>('/subscriptions/summary'),
      api.get<any[]>(`/transactions?status=pending&sort=date_asc&limit=100&from=${fromParam}&to=${toParam}`),
      api.get<any[]>('/categories'),
      api.get<any>('/loans/summary'),
    ]);

    summary.value = summaryRes;
    ranking.value = rankingRes;
    accounts.value = accountsRes;
    subscriptionsSummary.value = subscriptionsRes;
    categories.value = categoriesRes;

    const upcomingLoans = loansRes.items.filter((loan: any) => {
      if (loan.status !== 'active') return false;
      const loanDate = new Date(loan.date);
      return loanDate >= fromDate && loanDate <= toDate;
    }).map((loan: any) => {
      const type = loan.type === 'received' ? 'expense' : 'income';
      // Normalize amount sign: expenses should be negative
      const amount = type === 'expense' ? -Math.abs(Number(loan.amount)) : Math.abs(Number(loan.amount));
      return {
        id: loan.id,
        description: loan.description,
        amount: amount,
        type: type,
        occurredAt: loan.date,
        categoryId: null,
        isLoan: true,
        loanType: loan.type
      };
    });

    upcomingTransactions.value = [...transactionsRes, ...upcomingLoans].sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadData();
  window.addEventListener('transaction-created', loadData);
});

onUnmounted(() => {
  window.removeEventListener('transaction-created', loadData);
});
</script>

<template>
  <AppShell>
    <div class="mx-auto max-w-7xl px-4 py-8 space-y-6 relative z-10">
      
      <header class="flex items-center justify-between gap-4 flex-wrap mb-6">
        <h1 class="text-2xl font-bold tracking-tight text-white">Dashboard</h1>
        <div class="flex items-center gap-2">
          <button
            class="px-4 py-2 rounded-xl bg-expense/10 text-expense border border-expense/30 text-sm font-bold shadow-lg hover:bg-expense/20 transition-all hover:-translate-y-0.5 whitespace-nowrap flex items-center gap-1"
            @click="showCreate = true; createType = 'expense'"
          ><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg> Despesa</button>
          <button
            class="px-4 py-2 rounded-xl bg-income/10 text-income border border-income/30 text-sm font-bold shadow-lg hover:bg-income/20 transition-all hover:-translate-y-0.5 whitespace-nowrap flex items-center gap-1"
            @click="showCreate = true; createType = 'income'"
          ><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Receita</button>
        </div>
      </header>

      <DashboardKPIs 
        :summary="summary"
        :subscriptionsSummary="subscriptionsSummary"
        :loading="loading" 
      />

      <!-- Bottom row: Accounts, CreditCards, Categories, Upcoming -->
      <section class="grid lg:grid-cols-4 gap-6">
        <DashboardAccounts 
          :accounts="accounts"
          :loading="loading"
          @edit-account="editAccount"
        />
        <DashboardCreditCards 
          :accounts="accounts"
          :loading="loading"
        />
        <DashboardCategories 
          :ranking="ranking"
          :loading="loading"
        />
        <DashboardUpcoming 
          :upcomingTransactions="upcomingTransactions"
          :categoriesMap="categoriesMap"
          :loading="loading"
        />
      </section>
    </div>

    <!-- The modal is only loaded when showEditAccount becomes true -->
    <NewAccountModal
      v-if="showEditAccount"
      :open="showEditAccount"
      :account="editingAccount"
      @close="handleCloseAccount"
      @created="loadData"
    />

    <NewTransactionModal
      v-model:open="showCreate"
      :defaultType="createType"
      @created="loadData"
    />
  </AppShell>
</template>

<script lang="ts">
import NewTransactionModal from '../components/NewTransactionModal.vue';
export default {
  components: { NewTransactionModal }
}
</script>
