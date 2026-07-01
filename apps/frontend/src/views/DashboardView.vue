<script setup lang="ts">
import { computed, onMounted, ref, defineAsyncComponent, onUnmounted } from 'vue';
import { api } from '@moneyapp/api-client';
import AppShell from '../components/AppShell.vue';
import DashboardKPIs from '../components/dashboard/DashboardKPIs.vue';
import DashboardAccounts from '../components/dashboard/DashboardAccounts.vue';
import DashboardCreditCards from '../components/dashboard/DashboardCreditCards.vue';
import DashboardCategories from '../components/dashboard/DashboardCategories.vue';
import DashboardUpcoming from '../components/dashboard/DashboardUpcoming.vue';
import Modal from '../components/modals/Modal.vue';
import type { CategoryRankingResponse, DashboardSummaryResponse } from '@moneyapp/models';

// Lazy-load the modal so it's not in the initial bundle
const NewAccountModal = defineAsyncComponent(() => import('../components/modals/NewAccountModal.vue'));
const TransactionDetailsModal = defineAsyncComponent(() => import('../components/modals/TransactionDetailsModal.vue'));
const LoanModal = defineAsyncComponent(() => import('../components/modals/LoanModal.vue'));
const PayInvoiceModal = defineAsyncComponent(() => import('../components/modals/PayInvoiceModal.vue'));
const SubscriptionModal = defineAsyncComponent(() => import('../components/modals/SubscriptionModal.vue'));
const ConfirmPaymentModal = defineAsyncComponent(() => import('../components/modals/ConfirmPaymentModal.vue'));

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
const editingTransaction = ref<any | null>(null);

const showTransactionDetails = ref(false);
const transactionToView = ref<any | null>(null);

const showLoanModal = ref(false);
const loanToEdit = ref<any | null>(null);

const showSubscriptionModal = ref(false);
const subscriptionToEdit = ref<any | null>(null);

const showConfirmPayment = ref(false);
const itemToPay = ref<any | null>(null);

const showConfirmDismiss = ref(false);
const itemToDismiss = ref<any | null>(null);
const dismissedKeys = ref<string[]>(JSON.parse(localStorage.getItem('dismissedUpcoming') || '[]'));

const showPayInvoice = ref(false);
const payingAccount = ref<any | null>(null);

const showCreditCardActionModal = ref(false);
const creditCardActionItem = ref<any | null>(null);

const showUpcomingActionModal = ref(false);
const upcomingActionItem = ref<any | null>(null);

const brl = (n: number | string) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function handleActionItem(item: any) {
  upcomingActionItem.value = item;
  showUpcomingActionModal.value = true;
}

function choosePayUpcoming() {
  showUpcomingActionModal.value = false;
  if (upcomingActionItem.value) {
    handlePayUpcoming(upcomingActionItem.value);
  }
}

function chooseDismissUpcoming() {
  showUpcomingActionModal.value = false;
  if (upcomingActionItem.value) {
    handleDismissUpcoming(upcomingActionItem.value);
  }
}

async function handleDeleteTransactionFromDashboard() {
  if (!transactionToView.value) return;
  if (!confirm('Tem certeza que deseja excluir esta transação?')) return;
  try {
    await api.delete(`/transactions/${transactionToView.value.id}`);
    showTransactionDetails.value = false;
    transactionToView.value = null;
    loadData();
  } catch (err) {
    console.error('Failed to delete transaction', err);
  }
}

function handlePayUpcoming(item: any) {
  if (item.isCreditCard) {
    payingAccount.value = item.account;
    showPayInvoice.value = true;
  } else if (item.isLoan) {
    loanToEdit.value = item.originalItem;
    showLoanModal.value = true;
  } else if (item.isSubscription) {
    subscriptionToEdit.value = item.originalItem;
    showSubscriptionModal.value = true;
  } else {
    transactionToView.value = item;
    showTransactionDetails.value = true;
  }
}

function handleDismissUpcoming(item: any) {
  itemToDismiss.value = item;
  showConfirmDismiss.value = true;
}

function confirmDismiss() {
  if (!itemToDismiss.value) return;
  const monthStr = itemToDismiss.value.occurredAt.slice(0, 7);
  const key = `${itemToDismiss.value.id}_${monthStr}`;
  if (!dismissedKeys.value.includes(key)) dismissedKeys.value.push(key);
  localStorage.setItem('dismissedUpcoming', JSON.stringify(dismissedKeys.value));
  showConfirmDismiss.value = false;
  itemToDismiss.value = null;
  loadData();
}

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

function payInvoice(acc: any) {
  payingAccount.value = acc;
  showPayInvoice.value = true;
}

function handleCreditCardAction(acc: any) {
  creditCardActionItem.value = acc;
  showCreditCardActionModal.value = true;
}

function chooseEditCreditCard() {
  showCreditCardActionModal.value = false;
  if (creditCardActionItem.value) {
    editAccount(creditCardActionItem.value);
  }
}

function choosePayCreditCardInvoice() {
  showCreditCardActionModal.value = false;
  if (creditCardActionItem.value) {
    payInvoice(creditCardActionItem.value);
  }
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
        loanType: loan.type,
        originalItem: loan
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
        customIconUrl: sub.customIconUrl ?? '/banks/generic.svg',
        originalItem: sub
      };
    }).filter((sub: any) => {
       const d = new Date(sub.occurredAt);
       return d >= fromDate && d <= toDate;
    });

    upcomingTransactions.value = [...transactionsRes, ...upcomingLoans, ...creditCardInvoices, ...upcomingSubscriptions]
      .filter((t: any) => {
         const monthStr = t.occurredAt.slice(0, 7);
         return !dismissedKeys.value.includes(`${t.id}_${monthStr}`);
      })
      .sort((a, b) => {
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
  toDate.setDate(toDate.getDate() + 60);
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
      <section class="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-6">
        <DashboardAccounts 
          :accounts="accounts"
          :loading="loadingAccounts"
          @edit-account="editAccount"
        />
        <DashboardCreditCards 
          :accounts="accounts"
          :loading="loadingAccounts"
          @action="handleCreditCardAction"
        />
        <DashboardCategories 
          :ranking="ranking"
          :loading="loadingRanking"
        />
        <DashboardUpcoming 
          :upcomingTransactions="upcomingTransactions"
          :categoriesMap="categoriesMap"
          :loading="loadingUpcoming"
          @action="handleActionItem"
          @pay="handlePayUpcoming"
          @dismiss="handleDismissUpcoming"
        />
      </section>
    </div>

    <!-- The modal is only loaded when showEditAccount becomes true -->
    <NewAccountModal
      v-if="showEditAccount"
      v-model:open="showEditAccount"
      :account="editingAccount"
      @update:open="val => { if (!val) handleCloseAccount(); }"
      @created="loadData"
    />

    <NewTransactionModal
      v-model:open="showCreate"
      :transaction="editingTransaction"
      :defaultType="createType"
      @update:open="val => { if (!val) editingTransaction = null; }"
      @created="loadData"
    />

    <TransactionDetailsModal
      v-if="showTransactionDetails"
      v-model:open="showTransactionDetails"
      :transaction="transactionToView"
      :accountName="transactionToView?.accountId ? accounts.find(a => a.id === transactionToView.accountId)?.name : undefined"
      :categoryName="transactionToView?.categoryId ? categoriesMap.get(transactionToView.categoryId)?.name : undefined"
      :categoryColor="transactionToView?.categoryId ? categoriesMap.get(transactionToView.categoryId)?.color : undefined"
      @edit="() => { showTransactionDetails = false; editingTransaction = transactionToView; showCreate = true; }"
      @delete="handleDeleteTransactionFromDashboard"
    />

    <Modal :open="showConfirmDismiss" title="Remover do Mês" @close="showConfirmDismiss = false">
      <div class="space-y-4">
        <p class="text-sm text-muted">
          Tem certeza que deseja remover <strong>{{ itemToDismiss?.description }}</strong> do painel neste mês?
        </p>
        <div class="flex justify-end gap-2 pt-2">
          <button @click="showConfirmDismiss = false" class="px-4 py-2 rounded-xl border border-surface-border text-muted hover:text-slate-100">Cancelar</button>
          <button @click="confirmDismiss" class="px-4 py-2 rounded-xl bg-expense text-white font-medium hover:bg-expense/80">Remover</button>
        </div>
      </div>
    </Modal>

    <LoanModal
      v-if="showLoanModal"
      v-model:show="showLoanModal"
      :loan-to-edit="loanToEdit"
      @saved="loadData"
      @deleted="loadData"
    />

    <SubscriptionModal
      v-if="showSubscriptionModal"
      v-model:show="showSubscriptionModal"
      :subscription-to-edit="subscriptionToEdit"
      @saved="loadData"
      @deleted="loadData"
    />

    <Modal :open="showCreditCardActionModal" title="Opções do Cartão" @close="showCreditCardActionModal = false">
      <div class="space-y-4">
        <div class="p-4 bg-surface-overlay border border-surface-border rounded-xl">
          <p class="text-sm font-semibold text-white truncate">{{ creditCardActionItem?.name }}</p>
          <p class="text-lg font-bold text-expense mt-1 font-display" v-if="creditCardActionItem">
            {{ brl(Math.abs(Number(creditCardActionItem.currentBalance))) }}
          </p>
        </div>
        
        <div class="flex flex-col gap-2">
          <button @click="choosePayCreditCardInvoice" 
                  class="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl transition-colors shadow-lg"
                  :disabled="Math.abs(Number(creditCardActionItem?.currentBalance)) === 0"
                  :class="Math.abs(Number(creditCardActionItem?.currentBalance)) === 0 ? 'bg-surface-border text-muted cursor-not-allowed opacity-50' : 'bg-accent text-white hover:bg-accent/80 shadow-accent/20'">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            Pagar Fatura
          </button>
          
          <button @click="chooseEditCreditCard" class="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-surface-overlay border border-surface-border text-white hover:bg-surface-raised transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
            Editar Cartão
          </button>
        </div>
      </div>
    </Modal>

    <PayInvoiceModal
      v-model:open="showPayInvoice"
      :creditCard="payingAccount"
      @update:open="val => { if (!val) payingAccount = null; }"
      @paid="loadData"
    />

    <ConfirmPaymentModal
      v-if="showConfirmPayment"
      v-model:open="showConfirmPayment"
      :item="itemToPay"
      @paid="loadData"
    />

    <Modal :open="showUpcomingActionModal" title="Opções do Lançamento" @close="showUpcomingActionModal = false">
      <div class="space-y-4">
        <div class="p-4 bg-surface-overlay border border-surface-border rounded-xl">
          <p class="text-sm font-semibold text-white truncate">{{ upcomingActionItem?.description }}</p>
          <p class="text-lg font-bold mt-1 font-display" :class="upcomingActionItem?.type === 'expense' ? 'text-expense' : 'text-income'" v-if="upcomingActionItem">
            {{ brl(Math.abs(Number(upcomingActionItem.amount))) }}
          </p>
        </div>
        
        <div class="flex flex-col gap-2">
          <button @click="choosePayUpcoming" 
                  class="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl transition-colors shadow-lg"
                  :class="upcomingActionItem?.type === 'expense' ? 'bg-expense hover:bg-expense/80 shadow-expense/20' : 'bg-income hover:bg-income/80 shadow-income/20'"
                  >
            <span class="text-white">
               <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </span>
            <span class="text-white font-medium">Pagar Lançamento</span>
          </button>
          
          <button @click="chooseDismissUpcoming" class="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-surface-overlay border border-surface-border text-white hover:bg-surface-raised transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            Pular Mês
          </button>
        </div>
      </div>
    </Modal>
  </AppShell>
</template>

<script lang="ts">
import NewTransactionModal from '../components/modals/NewTransactionModal.vue';
export default {
  components: { NewTransactionModal }
}
</script>
