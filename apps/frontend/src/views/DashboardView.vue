<script setup lang="ts">
import { computed, onMounted, ref, defineAsyncComponent, onUnmounted } from 'vue';
import { api } from '@moneyapp/api-client';
import AppShell from '../components/AppShell.vue';
import DashboardKPIs from '../components/dashboard/DashboardKPIs.vue';
import DashboardAccounts from '../components/dashboard/DashboardAccounts.vue';
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
      <DashboardKPIs 
        :summary="summary"
        :subscriptionsSummary="subscriptionsSummary"
        :loading="loading" 
      />

      <!-- Bottom row: Accounts, Categories, Upcoming -->
      <section class="grid lg:grid-cols-3 gap-6">
        <DashboardAccounts 
          :accounts="accounts"
          :loading="loading"
          @edit-account="editAccount"
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
  </AppShell>
</template>
