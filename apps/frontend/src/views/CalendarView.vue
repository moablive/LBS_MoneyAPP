<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { api } from '@moneyapp/api-client';
import AppShell from '../components/AppShell.vue';
import { ChevronLeftIcon, ChevronRightIcon, XMarkIcon } from '@heroicons/vue/24/outline';

const loading = ref(true);
const transactions = ref<any[]>([]);
const currentMonth = ref(new Date());
const accounts = ref<any[]>([]);

const brl = (n: number | string) =>
  Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const selectedDay = ref<Date | null>(null);
const selectedDayTransactions = computed(() => {
  if (!selectedDay.value) return [];
  return getTransactionsForDay(selectedDay.value);
});
const closeModal = () => {
  selectedDay.value = null;
};

const loadAccounts = async () => {
  try {
    accounts.value = await api.get<any[]>('/accounts');
  } catch (e) {
    console.error(e);
  }
};

const loadData = async () => {
  loading.value = true;
  try {
    const year = currentMonth.value.getFullYear();
    const month = currentMonth.value.getMonth();
    
    // First and last day of the calendar grid
    const firstDay = new Date(year, month, 1);
    const firstDayOfWeek = firstDay.getDay();
    const gridStart = new Date(year, month, 1 - firstDayOfWeek);
    const gridEnd = new Date(year, month + 1, 7);

    const fromParam = gridStart.toISOString();
    const toParam = gridEnd.toISOString();
    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

    let transactionsRes: any[] = [];
    let loansRes: any = { items: [] };
    let subscriptionsRes: any = { items: [] };

    try {
      const [tRes, lRes, sRes] = await Promise.all([
        api.get<any[]>(`/transactions?from=${fromParam}&to=${toParam}&limit=200`),
        api.get<any>('/loans/summary'),
        api.get<any>('/subscriptions/summary'),
      ]);
      transactionsRes = Array.isArray(tRes) ? tRes : [];
      loansRes = lRes || { items: [] };
      subscriptionsRes = sRes || { items: [] };
    } catch (e) {
      console.error('API fetch error:', e);
      // Fallback: try fetching with month parameter if from/to fails
      try {
        transactionsRes = await api.get<any[]>(`/transactions?month=${monthStr}&limit=200`);
      } catch (err) {
        console.error('Fallback fetch error:', err);
      }
    }

    const upcomingLoans = (loansRes.items || []).filter((loan: any) => {
      if (loan.status !== 'active') return false;
      const loanDate = new Date(loan.date);
      return loanDate >= gridStart && loanDate <= gridEnd;
    }).map((loan: any) => {
      const type = loan.type === 'received' ? 'expense' : 'income';
      const amount = type === 'expense' ? -Math.abs(Number(loan.amount)) : Math.abs(Number(loan.amount));
      return {
        id: `loan-${loan.id}`,
        description: loan.description,
        amount: amount,
        type: type,
        occurredAt: loan.date,
        status: 'pending',
        isLoan: true,
        originalItem: loan
      };
    });

    const creditCardInvoices = accounts.value
      .filter(a => a.type === 'credit_card' && Number(a.currentBalance) !== 0 && !a.freezeBalance)
      .map(card => {
        let dueDate = new Date(year, month, card.dueDay || card.closingDay || 1, 12, 0, 0);
        return {
          id: `cc-${card.id}-${monthStr}`,
          description: `Fatura ${card.name}`,
          amount: -Math.abs(Number(card.currentBalance)),
          type: 'expense',
          occurredAt: dueDate.toISOString(),
          status: 'pending',
          isCreditCard: true,
          account: card
        };
      });

    const upcomingSubscriptions = (subscriptionsRes.items || []).filter((sub: any) => {
      return sub.status === 'active';
    }).map((sub: any) => {
      let subDate = new Date(year, month, sub.billingDay || 1, 12, 0, 0);
      return {
        id: `sub-${sub.id}-${monthStr}`,
        description: sub.description,
        amount: sub.type === 'expense' ? -Math.abs(Number(sub.amount)) : Math.abs(Number(sub.amount)),
        type: sub.type || 'expense',
        occurredAt: subDate.toISOString(),
        status: 'pending',
        isSubscription: true,
        originalItem: sub
      };
    });

    transactions.value = [...(Array.isArray(transactionsRes) ? transactionsRes : []), ...upcomingLoans, ...creditCardInvoices, ...upcomingSubscriptions]
      .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());

  } catch (e) {
    console.error('Fatal loadData error:', e);
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  await loadAccounts();
  await loadData();
});

watch(currentMonth, () => {
  loadData();
});

const prevMonth = () => {
  currentMonth.value = new Date(currentMonth.value.getFullYear(), currentMonth.value.getMonth() - 1, 1);
};

const nextMonth = () => {
  currentMonth.value = new Date(currentMonth.value.getFullYear(), currentMonth.value.getMonth() + 1, 1);
};

const currentMonthLabel = computed(() => {
  const m = currentMonth.value.toLocaleDateString('pt-BR', { month: 'long' });
  return `${m.charAt(0).toUpperCase() + m.slice(1)} ${currentMonth.value.getFullYear()}`;
});

const calendarDays = computed(() => {
  const year = currentMonth.value.getFullYear();
  const month = currentMonth.value.getMonth();
  
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  
  const days = [];
  
  // Fill leading empty days
  const firstDayOfWeek = firstDayOfMonth.getDay();
  for (let i = 0; i < firstDayOfWeek; i++) {
    const d = new Date(year, month, 1 - (firstDayOfWeek - i));
    days.push({ date: d, isCurrentMonth: false });
  }
  
  // Fill current month days
  for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
    const d = new Date(year, month, i);
    days.push({ date: d, isCurrentMonth: true });
  }
  
  // Fill trailing empty days
  const lastDayOfWeek = lastDayOfMonth.getDay();
  for (let i = 1; i < 7 - lastDayOfWeek; i++) {
    const d = new Date(year, month + 1, i);
    days.push({ date: d, isCurrentMonth: false });
  }
  
  return days;
});

const getTransactionsForDay = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const localDateStr = `${y}-${m}-${d}`;
  
  return transactions.value.filter(t => {
    if (!t || !t.occurredAt) return false;
    const tDate = new Date(t.occurredAt);
    if (isNaN(tDate.getTime())) return false;
    
    const ty = tDate.getFullYear();
    const tm = String(tDate.getMonth() + 1).padStart(2, '0');
    const td = String(tDate.getDate()).padStart(2, '0');
    const tDateStr = `${ty}-${tm}-${td}`;
    
    return tDateStr === localDateStr;
  });
};

const isToday = (date: Date) => {
  const today = new Date();
  return date.getDate() === today.getDate() && 
         date.getMonth() === today.getMonth() && 
         date.getFullYear() === today.getFullYear();
};

</script>

<template>
  <AppShell>
    <div class="max-w-7xl mx-auto space-y-6">
      
      <!-- Cabeçalho -->
      <div class="flex items-center justify-between bg-surface-overlay p-4 rounded-2xl border border-surface-border">
        <h1 class="text-2xl font-bold font-display text-white">Calendário</h1>
        <div class="flex items-center gap-4">
          <button @click="prevMonth" class="p-2 hover:bg-surface-border rounded-lg transition-colors text-white">
            <ChevronLeftIcon class="w-5 h-5" />
          </button>
          <span class="text-lg font-medium text-white w-48 text-center">{{ currentMonthLabel }}</span>
          <button @click="nextMonth" class="p-2 hover:bg-surface-border rounded-lg transition-colors text-white">
            <ChevronRightIcon class="w-5 h-5" />
          </button>
        </div>
      </div>

      <!-- Calendário -->
      <div class="bg-surface-overlay rounded-2xl border border-surface-border overflow-hidden flex flex-col">
        <!-- Dias da semana -->
        <div class="grid grid-cols-7 border-b border-surface-border bg-surface">
          <div v-for="day in ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']" :key="day" class="py-3 text-center text-sm font-medium text-muted uppercase tracking-wider">
            {{ day }}
          </div>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="p-12 flex justify-center">
          <div class="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
        </div>

        <!-- Grade de Dias -->
        <div v-else class="grid grid-cols-7 auto-rows-[minmax(120px,auto)] bg-surface-border gap-px">
          <div v-for="(day, idx) in calendarDays" :key="idx" 
               class="bg-surface-overlay p-2 flex flex-col gap-1 transition-colors hover:bg-surface-border/50"
               :class="{'opacity-50': !day.isCurrentMonth}">
            <div class="flex justify-between items-start mb-1">
              <span class="text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full"
                    :class="isToday(day.date) ? 'bg-accent text-white' : 'text-muted'">
                {{ day.date.getDate() }}
              </span>
            </div>
            
            <div class="flex-1 flex flex-col justify-end p-1">
              <template v-for="txs in [getTransactionsForDay(day.date)]" :key="'txs-'+idx">
                <button 
                  v-if="txs.length > 0"
                  @click="selectedDay = day.date"
                  class="w-full font-semibold bg-accent/10 hover:bg-accent/20 text-accent transition-colors py-1 sm:py-2 px-1 rounded-lg text-center border border-accent/20 leading-tight flex flex-col sm:flex-row items-center justify-center gap-0 sm:gap-1"
                >
                  <span class="text-sm sm:text-xs">{{ txs.length }}</span>
                  <span class="hidden sm:inline text-xs">Lançamento{{ txs.length !== 1 ? 's' : '' }}</span>
                  <span class="sm:hidden text-[9px] uppercase tracking-wider mt-0.5">item{{ txs.length !== 1 ? 's' : '' }}</span>
                </button>
              </template>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal de Transações do Dia -->
      <div v-if="selectedDay" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="closeModal"></div>
        <div class="relative bg-surface border border-surface-border rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh]">
          <div class="flex items-center justify-between p-5 border-b border-surface-border">
            <h3 class="text-xl font-display font-bold text-white">
              Dia {{ String(selectedDay.getDate()).padStart(2, '0') }}/{{ String(selectedDay.getMonth() + 1).padStart(2, '0') }}
            </h3>
            <button @click="closeModal" class="p-2 hover:bg-surface-border rounded-lg transition-colors text-muted hover:text-white">
              <XMarkIcon class="w-6 h-6" />
            </button>
          </div>
          
          <div class="p-5 overflow-y-auto custom-scrollbar flex-1 space-y-3">
            <div v-if="selectedDayTransactions.length === 0" class="text-center text-muted py-8">
              Nenhuma transação neste dia.
            </div>
            <div v-for="t in selectedDayTransactions" :key="t.id" 
                 class="flex items-center justify-between p-4 rounded-xl border border-surface-border/50 bg-surface-overlay"
                 :class="t.status === 'paid' ? 'border-l-4 border-l-green-500/50' : 'border-l-4 border-l-yellow-500/50'">
              <div class="flex-1 min-w-0 pr-4">
                <div class="font-semibold text-white truncate text-base mb-1">{{ t.description }}</div>
                <div class="flex items-center gap-2 text-xs font-medium">
                  <span :class="t.status === 'paid' ? 'text-green-500 bg-green-500/10' : 'text-yellow-500 bg-yellow-500/10'" 
                        class="px-2 py-0.5 rounded-full uppercase tracking-wider">
                    {{ t.status === 'paid' ? 'Pago' : 'Pendente' }}
                  </span>
                  <span v-if="t.type" class="text-muted/60 uppercase tracking-wider">{{ t.type === 'expense' ? 'Saída' : 'Entrada' }}</span>
                </div>
              </div>
              <div class="text-right flex flex-col justify-center">
                <div class="font-display font-bold text-lg" :class="t.type === 'expense' || Number(t.amount) < 0 ? 'text-red-400' : 'text-green-400'">
                  {{ brl(t.amount) }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  </AppShell>
</template>
