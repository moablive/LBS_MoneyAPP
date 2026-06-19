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
const NewAccountModal = defineAsyncComponent(() => import('../components/modals/NewAccountModal.vue'));

const summary = ref<DashboardSummaryResponse | null>(null);
const ranking = ref<CategoryRankingResponse | null>(null);
const accounts = ref<any[]>([]);
const subscriptionsSummary = ref<any | null>(null);
const upcomingTransactions = ref<any[]>([]);
const categories = ref<any[]>([]);

const loadingSummary = ref(true);
const loadingRanking = ref(true);
const loadingAccounts = ref(true);
const loadingUpcoming = ref(true);

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

const loadSummary = async () => {
  loadingSummary.value = true;
  try {
    const [summaryRes, subscriptionsRes] = await Promise.all([
      api.get<DashboardSummaryResponse>('/dashboard/summary'),
      api.get<any>('/subscriptions/summary'),
    ]);
    summary.value = summaryRes;
    subscriptionsSummary.value = subscriptionsRes;
  } catch (e) {
    console.error(e);
  } finally {
    loadingSummary.value = false;
  }
};

const loadRanking = async () => {
  loadingRanking.value = true;
  try {
    ranking.value = await api.get<CategoryRankingResponse>('/dashboard/categories/ranking?type=expense&includeZero=true');
  } catch (e) {
    console.error(e);
  } finally {
    loadingRanking.value = false;
  }
};

const loadAccounts = async () => {
  loadingAccounts.value = true;
  try {
    accounts.value = await api.get<any[]>('/accounts');
  } catch (e) {
    console.error(e);
  } finally {
    loadingAccounts.value = false;
  }
};

const loadUpcoming = async (fromParam: string, toParam: string, fromDate: Date, toDate: Date) => {
  loadingUpcoming.value = true;
  try {
    const [transactionsRes, categoriesRes, loansRes, subscriptionsRes] = await Promise.all([
      api.get<any[]>(`/transactions?status=pending&sort=date_asc&limit=100&from=${fromParam}&to=${toParam}`),
      api.get<any[]>('/categories'),
      api.get<any>('/loans/summary'),
      api.get<any>('/subscriptions/summary'),
    ]);
    
    categories.value = categoriesRes;

    const upcomingLoans = loansRes.items.filter((loan: any) => {
      if (loan.status !== 'active') return false;
      const loanDate = new Date(loan.date);
      return loanDate >= fromDate && loanDate <= toDate;
    }).map((loan: any) => {
      const type = loan.type === 'received' ? 'expense' : 'income';
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

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const creditCardInvoices = accounts.value
      .filter(a => a.type === 'credit_card' && Number(a.currentBalance) !== 0 && !a.freezeBalance)
      .map(card => {
        let dueDate = new Date(today.getFullYear(), today.getMonth(), card.dueDay || card.closingDay || 1, 12, 0, 0);
        if (dueDate < today) {
           dueDate.setMonth(dueDate.getMonth() + 1);
        }
        return {
          id: `cc-${card.id}`,
          description: `Fatura ${card.name}`,
          amount: -Math.abs(Number(card.currentBalance)),
          type: 'expense',
          occurredAt: dueDate.toISOString(),
          categoryId: null,
          isCreditCard: true,
          account: card
        };
      })
      .filter(cc => {
         const d = new Date(cc.occurredAt);
         return d >= fromDate && d <= toDate;
      });
    const upcomingSubscriptions = (subscriptionsRes?.items || []).filter((sub: any) => {
      if (sub.status !== 'active') return false;
      return true;
    }).map((sub: any) => {
      let subDate = new Date(today.getFullYear(), today.getMonth(), sub.billingDay || 1, 12, 0, 0);
      if (subDate < today) {
         subDate.setMonth(subDate.getMonth() + 1);
      }
      return {
        id: `sub-${sub.id}`,
        description: sub.description,
        amount: sub.type === 'expense' ? -Math.abs(Number(sub.amount)) : Math.abs(Number(sub.amount)),
        type: sub.type || 'expense',
        occurredAt: subDate.toISOString(),
        categoryId: sub.categoryId,
        isSubscription: true,
        customIconUrl: sub.customIconUrl ?? '/banks/generic.svg'
      };
    }).filter((sub: any) => {
       const d = new Date(sub.occurredAt);
       return d >= fromDate && d <= toDate;
    });

    upcomingTransactions.value = [...transactionsRes, ...upcomingLoans, ...creditCardInvoices, ...upcomingSubscriptions].sort((a, b) => {
      const dayA = Number(a.occurredAt.slice(8, 10));
      const dayB = Number(b.occurredAt.slice(8, 10));
      if (dayA !== dayB) return dayA - dayB;
      return new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime();
    });
  } catch (e) {
    console.error(e);
  } finally {
    loadingUpcoming.value = false;
  }
};

const loadData = () => {
  const fromDate = new Date();
  fromDate.setHours(0, 0, 0, 0);

  const toDate = new Date(fromDate);
  toDate.setMonth(toDate.getMonth() + 1);
  toDate.setHours(23, 59, 59, 999);
  
  const fromParam = fromDate.toISOString();
  const toParam = toDate.toISOString();

  loadSummary();
  loadRanking();
  loadAccounts().then(() => {
    loadUpcoming(fromParam, toParam, fromDate, toDate);
  });
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
      </header>

      <DashboardKPIs 
        :summary="summary"
        :subscriptionsSummary="subscriptionsSummary"
        :loading="loadingSummary" 
      />

      <!-- Bottom row: Accounts, CreditCards, Categories, Upcoming -->
      <section class="grid lg:grid-cols-4 gap-6">
        <DashboardAccounts 
          :accounts="accounts"
          :loading="loadingAccounts"
          @edit-account="editAccount"
        />
        <DashboardCreditCards 
          :accounts="accounts"
          :loading="loadingAccounts"
        />
        <DashboardCategories 
          :ranking="ranking"
          :loading="loadingRanking"
        />
        <DashboardUpcoming 
          :upcomingTransactions="upcomingTransactions"
          :categoriesMap="categoriesMap"
          :loading="loadingUpcoming"
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
import NewTransactionModal from '../components/modals/NewTransactionModal.vue';
export default {
  components: { NewTransactionModal }
}
</script>
