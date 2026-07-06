<script setup lang="ts">
import { computed, onMounted, ref, defineAsyncComponent, onUnmounted } from 'vue';
import { api } from '@moneyapp/api-client';
import AppShell from '../components/AppShell.vue';
import DashboardKPIs from '../components/dashboard/DashboardKPIs.vue';
import DashboardAccounts from '../components/dashboard/DashboardAccounts.vue';
import DashboardCreditCards from '../components/dashboard/DashboardCreditCards.vue';
import DashboardCategories from '../components/dashboard/DashboardCategories.vue';
import DashboardUpcoming from '../components/dashboard/DashboardUpcoming.vue';
import DashboardMensalidades from '../components/dashboard/DashboardMensalidades.vue';
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
const mensalidadesList = ref<any[]>([]);
const categories = ref<any[]>([]);

const loadingSummary = ref(true);
const loadingRanking = ref(true);
const loadingAccounts = ref(true);
const loadingUpcoming = ref(true);

const upcomingList = computed(() => upcomingTransactions.value);

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
const customDatesUpcoming = ref<Record<string, string>>(JSON.parse(localStorage.getItem('customDatesUpcoming') || '{}'));

const showPayInvoice = ref(false);
const payingAccount = ref<any | null>(null);

const showCreditCardActionModal = ref(false);
const creditCardActionItem = ref<any | null>(null);

const showUpcomingActionModal = ref(false);
const upcomingActionItem = ref<any | null>(null);

const showChangeDateModal = ref(false);
const changeDateValue = ref('');

const showTodoAppEvents = ref(localStorage.getItem('showTodoAppEvents') === 'true');

async function toggleTodoAppEvents() {
  showTodoAppEvents.value = !showTodoAppEvents.value;
  localStorage.setItem('showTodoAppEvents', String(showTodoAppEvents.value));
  api.patch('/users/me/settings', { showTodoAppEvents: showTodoAppEvents.value }).catch(console.error);
  loadData();
}

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

function chooseEditUpcoming() {
  showUpcomingActionModal.value = false;
  if (!upcomingActionItem.value) return;
  
  changeDateValue.value = upcomingActionItem.value.occurredAt.slice(0, 10);
  showChangeDateModal.value = true;
}

function saveCustomDate() {
  if (!upcomingActionItem.value || !changeDateValue.value) return;
  const item = upcomingActionItem.value;
  
  const newDate = new Date(`${changeDateValue.value}T12:00:00Z`).toISOString();
  customDatesUpcoming.value[item.itemKey] = newDate;
  localStorage.setItem('customDatesUpcoming', JSON.stringify(customDatesUpcoming.value));
  
  showChangeDateModal.value = false;
  loadData();
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
    itemToPay.value = item;
    showConfirmPayment.value = true;
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
  const key = itemToDismiss.value.itemKey;
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
    const promises: Promise<any>[] = [
      api.get<any[]>(`/transactions?sort=date_desc&limit=200&from=${fromParam}&to=${toParam}`),
      api.get<any[]>('/categories'),
      api.get<any>('/loans/summary'),
      api.get<any>('/subscriptions/summary'),
    ];

    if (showTodoAppEvents.value) {
      promises.push(api.get<any[]>(`/integrations/todoapp/tasks?start=${fromParam}&end=${toParam}`).catch(() => []));
    } else {
      promises.push(Promise.resolve([]));
    }

    const [transactionsRes, categoriesRes, loansRes, subscriptionsRes, todoTasksRes] = await Promise.all(promises);
    
    categories.value = categoriesRes;

    const upcomingLoans = loansRes.items.filter((loan: any) => {
      if (loan.status !== 'active') return false;
      const loanDate = new Date(loan.date);
      return loanDate >= fromDate && loanDate <= toDate;
    }).map((loan: any) => {
      const type = loan.type === 'received' ? 'expense' : 'income';
      const amount = type === 'expense' ? -Math.abs(Number(loan.amount)) : Math.abs(Number(loan.amount));
      const originalDateStr = loan.date;
      const monthStr = originalDateStr.slice(0, 7);
      const itemKey = `${loan.id}_${monthStr}`;
      
      let displayDate = originalDateStr;
      if (customDatesUpcoming.value[itemKey]) {
        displayDate = customDatesUpcoming.value[itemKey];
      }
      
      return {
        id: loan.id,
        description: loan.description,
        amount: amount,
        type: type,
        occurredAt: displayDate,
        originalOccurredAt: originalDateStr,
        itemKey: itemKey,
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
        
        const originalDateStr = dueDate.toISOString();
        const monthStr = originalDateStr.slice(0, 7);
        const itemKey = `cc-${card.id}_${monthStr}`;
        
        let displayDate = originalDateStr;
        if (customDatesUpcoming.value[itemKey]) {
          displayDate = customDatesUpcoming.value[itemKey];
        }
        
        return {
          id: `cc-${card.id}`,
          description: `Fatura ${card.name}`,
          amount: -Math.abs(Number(card.currentBalance)),
          type: 'expense',
          occurredAt: displayDate,
          originalOccurredAt: originalDateStr,
          itemKey: itemKey,
          categoryId: null,
          isCreditCard: true,
          account: card
        };
      })
      .filter(cc => {
         const d = new Date(cc.originalOccurredAt);
         return d >= fromDate && d <= toDate;
      });
    const upcomingSubscriptions = (subscriptionsRes?.items || []).filter((sub: any) => {
      if (sub.status !== 'active') return false;
      return true;
    }).map((sub: any) => {
      const hasPaid = transactionsRes.some(t => t.subscriptionId === sub.id && t.status === 'paid');
      
      let subDate = new Date(today.getFullYear(), today.getMonth(), sub.billingDay || 1, 12, 0, 0);
      
      const originalDateStr = subDate.toISOString();
      const monthStr = originalDateStr.slice(0, 7);
      const itemKey = `sub-${sub.id}-${monthStr}_${monthStr}`;
      
      const isDismissed = dismissedKeys.value.includes(itemKey);
      const isPaid = hasPaid || isDismissed;
      
      let displayDate = originalDateStr;
      if (customDatesUpcoming.value[itemKey]) {
        displayDate = customDatesUpcoming.value[itemKey];
      }
      
      return {
        id: `sub-${sub.id}-${monthStr}`,
        description: sub.description,
        amount: sub.type === 'expense' ? -Math.abs(Number(sub.amount)) : Math.abs(Number(sub.amount)),
        type: sub.type || 'expense',
        occurredAt: displayDate,
        originalOccurredAt: originalDateStr,
        itemKey: itemKey,
        categoryId: sub.categoryId,
        isSubscription: true,
        customIconUrl: sub.customIconUrl ?? '/banks/generic.svg',
        originalItem: sub,
        statusTag: isPaid ? 'paid' : 'pending'
      };
    }).sort((a: any, b: any) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
    
    mensalidadesList.value = upcomingSubscriptions;

    const pendingTransactions = transactionsRes.filter((t: any) => t.status === 'pending').map((t: any) => {
      const originalDateStr = t.occurredAt;
      const monthStr = originalDateStr.slice(0, 7);
      const itemKey = `${t.id}_${monthStr}`;
      
      let displayDate = originalDateStr;
      if (customDatesUpcoming.value[itemKey]) {
        displayDate = customDatesUpcoming.value[itemKey];
      }
      return {
        ...t,
        occurredAt: displayDate,
        originalOccurredAt: originalDateStr,
        itemKey: itemKey
      };
    });

    const todoTasks = (todoTasksRes || []).map((task: any) => {
      const originalDateStr = task.scheduledAt || task.createdAt;
      const monthStr = originalDateStr.slice(0, 7);
      const itemKey = `todo_${task.id}_${monthStr}`;
      
      return {
        id: `todo-${task.id}`,
        description: task.description,
        amount: 0,
        type: 'expense',
        occurredAt: originalDateStr,
        originalOccurredAt: originalDateStr,
        itemKey: itemKey,
        categoryId: null,
        isTodoTask: true,
        task: task
      };
    });

    upcomingTransactions.value = [...pendingTransactions, ...upcomingLoans, ...creditCardInvoices, ...todoTasks]
      .filter((t: any) => {
         return !dismissedKeys.value.includes(t.itemKey);
      })
      .sort((a: any, b: any) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  } catch (e) {
    console.error(e);
  } finally {
    loadingUpcoming.value = false;
  }
};

const loadData = () => {
  const today = new Date();
  
  const fromDate = new Date(today.getFullYear(), today.getMonth(), 1);
  fromDate.setHours(0, 0, 0, 0);

  const toDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
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
        <button
          @click="toggleTodoAppEvents"
          class="flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all"
          :class="showTodoAppEvents ? 'border-accent bg-accent/10 text-accent' : 'border-surface-border text-muted hover:text-white hover:bg-surface-hover'"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>
          <span class="text-sm font-medium">TodoAPP</span>
        </button>
      </header>

      <DashboardKPIs 
        :summary="summary"
        :subscriptionsSummary="subscriptionsSummary"
        :loading="loadingSummary" 
      />

      <!-- Bottom row: Accounts, CreditCards, Categories, Upcoming -->
      <section class="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-5 gap-6">
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
          :upcomingTransactions="upcomingList"
          :categoriesMap="categoriesMap"
          :loading="loadingUpcoming"
          @action="handleActionItem"
          @pay="handlePayUpcoming"
          @dismiss="handleDismissUpcoming"
        />
        <DashboardMensalidades 
          :mensalidadesList="mensalidadesList"
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
      <div class="space-y-6">
        <div class="relative p-5 rounded-2xl overflow-hidden shadow-lg border border-surface-border/50 bg-gradient-to-br from-surface-overlay to-surface-raised/80 group">
          <div class="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <p class="text-xs font-semibold text-muted uppercase tracking-wider mb-1 flex items-center gap-2">
             Cartão de Crédito
          </p>
          <p class="text-base font-medium text-white truncate relative z-10">{{ creditCardActionItem?.name }}</p>
          <p class="text-3xl font-bold text-expense mt-2 font-display tracking-tight relative z-10" v-if="creditCardActionItem">
            {{ brl(Math.abs(Number(creditCardActionItem.currentBalance))) }}
          </p>
        </div>
        
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button @click="choosePayCreditCardInvoice" 
                  class="col-span-1 sm:col-span-2 flex flex-col items-center justify-center gap-1.5 p-4 rounded-xl transition-all shadow-lg hover:-translate-y-0.5 active:translate-y-0"
                  :disabled="Math.abs(Number(creditCardActionItem?.currentBalance)) === 0"
                  :class="Math.abs(Number(creditCardActionItem?.currentBalance)) === 0 ? 'bg-surface-border text-muted cursor-not-allowed opacity-50' : 'bg-gradient-to-b from-accent/90 to-accent hover:from-accent hover:to-accent/90 shadow-accent/25'">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white drop-shadow-sm"><polyline points="20 6 9 17 4 12"></polyline></svg>
            <span class="text-white font-bold tracking-wide">Pagar Fatura</span>
          </button>
          
          <button @click="chooseEditCreditCard" 
                  class="col-span-1 sm:col-span-2 flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl bg-surface-overlay/80 hover:bg-surface-raised border border-surface-border/60 text-white transition-all shadow-sm hover:shadow hover:-translate-y-0.5 group">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted group-hover:text-white transition-colors"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
            <span class="text-sm font-medium">Editar Cartão</span>
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

    <Modal :open="showUpcomingActionModal" :title="upcomingActionItem?.isSubscription ? 'Opções da Assinatura' : 'Opções do Lançamento'" @close="showUpcomingActionModal = false">
      <div class="space-y-6">
        <div class="relative p-5 rounded-2xl overflow-hidden shadow-lg border border-surface-border/50 bg-gradient-to-br from-surface-overlay to-surface-raised/80 group">
          <div class="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <p class="text-xs font-semibold text-muted uppercase tracking-wider mb-1 flex items-center gap-2">
             <span v-if="upcomingActionItem?.isSubscription">Assinatura Mensal</span>
             <span v-else-if="upcomingActionItem?.isCreditCard">Fatura de Cartão</span>
             <span v-else>Lançamento Recorrente</span>
          </p>
          <p class="text-base font-medium text-white truncate relative z-10">{{ upcomingActionItem?.description }}</p>
          <p class="text-3xl font-bold mt-2 font-display tracking-tight relative z-10" :class="upcomingActionItem?.type === 'expense' ? 'text-expense' : 'text-income'" v-if="upcomingActionItem">
            {{ brl(Math.abs(Number(upcomingActionItem.amount))) }}
          </p>
          
           <div class="mt-3 inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-surface-base/50 text-xs text-white/80 border border-surface-border/50">
             <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
             <span v-if="upcomingActionItem?.occurredAt">
               {{ new Date(upcomingActionItem.occurredAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', timeZone: 'UTC' }) }}
             </span>
           </div>
        </div>
        
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button @click="choosePayUpcoming" 
                  class="col-span-1 sm:col-span-2 flex flex-col items-center justify-center gap-1.5 p-4 rounded-xl transition-all shadow-lg hover:-translate-y-0.5 active:translate-y-0"
                  :class="upcomingActionItem?.type === 'expense' ? 'bg-gradient-to-b from-expense/90 to-expense hover:from-expense hover:to-expense/90 shadow-expense/25' : 'bg-gradient-to-b from-income/90 to-income hover:from-income hover:to-income/90 shadow-income/25'">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white drop-shadow-sm"><polyline points="20 6 9 17 4 12"></polyline></svg>
            <span class="text-white font-bold tracking-wide">Pagar Lançamento</span>
          </button>
          
          <button @click="chooseEditUpcoming" 
                  class="flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl bg-surface-overlay/80 hover:bg-surface-raised border border-surface-border/60 text-white transition-all shadow-sm hover:shadow hover:-translate-y-0.5 group">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted group-hover:text-white transition-colors"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/><path d="m9 16 2 2 4-4"/></svg>
            <span class="text-sm font-medium">Mudar Data</span>
          </button>
          
          <button @click="chooseDismissUpcoming" 
                  class="flex flex-col items-center justify-center gap-2 p-3.5 rounded-xl bg-surface-overlay/80 hover:bg-surface-raised border border-surface-border/60 text-white transition-all shadow-sm hover:shadow hover:-translate-y-0.5 group">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted group-hover:text-white transition-colors" v-if="!upcomingActionItem?.isSubscription"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-income group-hover:text-income transition-colors" v-else><polyline points="20 6 9 17 4 12"></polyline></svg>
            <span class="text-sm font-medium" v-if="upcomingActionItem?.isSubscription">Já Paguei</span>
            <span class="text-sm font-medium" v-else>Pular Mês</span>
          </button>
        </div>
      </div>
    </Modal>
    
    <Modal :open="showChangeDateModal" title="Data Auxiliar de Pagamento" @close="showChangeDateModal = false">
      <div class="space-y-4">
        <p class="text-sm text-muted">
          Selecione a data em que você planeja pagar este lançamento (apenas para organizar o seu painel este mês):
        </p>
        <input
          v-model="changeDateValue"
          type="date"
          class="w-full bg-surface-overlay border border-surface-border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/60 [color-scheme:dark]"
        />
        <div class="flex justify-end gap-2 pt-2">
          <button @click="showChangeDateModal = false" class="px-4 py-2 rounded-xl border border-surface-border text-muted hover:text-slate-100">Cancelar</button>
          <button @click="saveCustomDate" class="px-4 py-2 rounded-xl bg-accent text-white font-medium">Salvar Data Auxiliar</button>
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
