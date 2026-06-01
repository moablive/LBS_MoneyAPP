<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api } from '@moneyapp/shared';
import AppShell from '../components/AppShell.vue';
import NewAccountModal from '../components/NewAccountModal.vue';
import type {
  CategoryRankingResponse,
  DashboardSummaryResponse,
} from '@moneyapp/shared';

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

const totalPositiveBalance = computed(() => {
  return accounts.value.reduce((acc, account) => {
    const bal = Number(account.currentBalance);
    return acc + (bal > 0 ? bal : 0);
  }, 0);
});

const getAccountShare = (balance: number | string) => {
  const num = Number(balance);
  if (totalPositiveBalance.value === 0 || num <= 0) return 0;
  return (num / totalPositiveBalance.value) * 100;
};

const sortedAccounts = computed(() => {
  return [...accounts.value].sort((a, b) => Number(b.currentBalance) - Number(a.currentBalance));
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
    const toDate = new Date();
    toDate.setDate(toDate.getDate() + 30);
    const toParam = toDate.toISOString();

    [summary.value, ranking.value, accounts.value, subscriptionsSummary.value, upcomingTransactions.value, categories.value] = await Promise.all([
      api.get<DashboardSummaryResponse>('/dashboard/summary'),
      api.get<CategoryRankingResponse>('/dashboard/categories/ranking?type=expense&includeZero=true'),
      api.get<any[]>('/accounts'),
      api.get<any>('/subscriptions/summary'),
      api.get<any[]>(`/transactions?status=pending&sort=date_asc&limit=100&to=${toParam}`),
      api.get<any[]>('/categories'),
    ]);
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadData();
  window.addEventListener('transaction-created', loadData);
});

import { onUnmounted } from 'vue';
onUnmounted(() => {
  window.removeEventListener('transaction-created', loadData);
});

const brl = (n: number | string) =>
  Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatDay = (iso: string) => {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return {
    day: d.toLocaleDateString('pt-BR', { day: '2-digit', timeZone: 'UTC' }),
    month: d.toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' }).replace('.', '').slice(0, 3)
  };
};

const kpis = [
  { key: 'closingBalance', label: 'Saldo Atual', tone: '' as const, icon: '💰' },
  { key: 'income',         label: 'Receitas',      tone: 'income' as const, icon: '📈' },
  { key: 'expense',        label: 'Despesas',      tone: 'expense' as const, icon: '📉' },
  { key: 'fixedCosts',     label: 'Custo Fixo',    tone: 'expense' as const, icon: '🔄' },
] as const;

function toneClass(tone: string): string {
  if (tone === 'income') return 'text-income';
  if (tone === 'expense') return 'text-expense';
  return 'text-white';
}

function formatKpi(s: DashboardSummaryResponse, key: typeof kpis[number]['key']): string {
  if (key === 'fixedCosts') return brl(subscriptionsSummary.value?.gastoMensal ?? 0);
  return brl(s[key as keyof DashboardSummaryResponse] as number);
}


</script>

<template>
  <AppShell>
    <div class="mx-auto max-w-7xl px-4 py-8 space-y-6">


      <!-- KPI cards -->
      <section class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div v-for="k in kpis" :key="k.key" class="card bg-surface-raised border border-surface-border p-6 shadow-xl relative overflow-hidden group">
          <div class="flex justify-between items-start">
            <div>
              <div class="text-[11px] font-semibold text-muted uppercase tracking-wider mb-2">{{ k.label }}</div>
              <div v-if="loading" class="skeleton h-8 w-24" />
              <div v-else-if="summary" class="text-2xl font-bold tabular-nums" :class="toneClass(k.tone)">
                {{ formatKpi(summary, k.key) }}
              </div>
            </div>
            <div class="p-3 bg-surface-overlay rounded-lg text-xl group-hover:scale-110 transition-transform">
              {{ k.icon }}
            </div>
          </div>
        </div>
      </section>

      <!-- Bottom row: Accounts, Categories, Upcoming -->
      <section class="grid lg:grid-cols-3 gap-6">
        <!-- Minhas Contas -->
        <div class="card bg-surface-raised border border-surface-border p-6 shadow-xl">
          <h2 class="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Saldos</h2>
          <h3 class="text-lg text-white font-medium mb-6">Minhas Contas</h3>
          
          <div v-if="loading" class="space-y-4">
            <div v-for="i in 4" :key="i" class="skeleton h-14 w-full" />
          </div>
          <ul v-else class="space-y-5 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            <li v-for="acc in sortedAccounts" :key="acc.id" class="cursor-pointer group hover:bg-surface-overlay/40 p-2 -mx-2 rounded-xl transition-colors" @click="editAccount(acc)">
              <div class="flex items-center gap-3 mb-2">
                <div class="flex items-center justify-center w-8 h-8 rounded-lg bg-surface-base border border-surface-border shrink-0">
                  <img v-if="acc.customIconUrl" :src="acc.customIconUrl" class="w-5 h-5 rounded-md object-contain" />
                  <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-accent"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a8 8 0 0 1-5.45 7.49 1 1 0 0 1-1.22-1.08L14 16.5a1 1 0 0 0-1-1H7.5a1 1 0 0 0-1 1L5.5 20.41a1 1 0 0 1-1.22 1.08A8 8 0 0 1 2 14v-5"/><path d="M20 12v4M20 16a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2"/></svg>
                </div>
                <div class="flex-1 flex items-baseline justify-between text-sm">
                  <span class="font-medium text-white/90 group-hover:text-accent transition-colors">{{ acc.name }}</span>
                  <span class="tabular-nums font-semibold" :class="Number(acc.currentBalance) >= 0 ? 'text-white' : 'text-expense'">{{ brl(Number(acc.currentBalance)) }}</span>
                </div>
              </div>
              <div class="h-1.5 rounded-full bg-surface-overlay overflow-hidden ml-11">
                <div class="h-full bg-accent transition-[width] duration-500 ease-smooth" :style="{ width: `${Math.min(100, getAccountShare(acc.currentBalance))}%` }" />
              </div>
            </li>
          </ul>
        </div>
        <div class="card bg-surface-raised border border-surface-border p-6 shadow-xl">
          <h2 class="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Análise</h2>
          <h3 class="text-lg text-white font-medium mb-6">Principais Categorias</h3>
          
          <div v-if="loading" class="space-y-4">
            <div v-for="i in 5" :key="i" class="skeleton h-12 w-full" />
          </div>
          <ul v-else-if="ranking" class="space-y-5 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            <li v-for="item in ranking.ranking" :key="item.categoryId" class="space-y-2">
              <div class="flex items-baseline justify-between text-sm">
                <span class="font-medium text-white/90">{{ item.name }}</span>
                <span class="tabular-nums font-semibold">{{ brl(item.current) }}</span>
              </div>
              <div class="h-1.5 rounded-full bg-surface-overlay overflow-hidden">
                <div class="h-full transition-[width] duration-500 ease-smooth" :style="{ width: `${Math.min(100, item.share)}%`, backgroundColor: item.color || '#d946ef' }" />
              </div>
              <div class="flex justify-between text-[11px] text-muted">
                <span>Anterior: {{ brl(item.previous) }}</span>
                <span v-if="item.variationPct !== null" :class="item.variationPct >= 0 ? 'text-expense' : 'text-accent'">
                  {{ item.variationPct >= 0 ? '+' : '' }}{{ item.variationPct.toFixed(1) }}%
                </span>
                <span v-else class="text-muted">novo</span>
              </div>
            </li>
          </ul>
        </div>


        <!-- Próximos Lançamentos -->
        <div class="card bg-surface-raised border border-surface-border p-6 shadow-xl flex flex-col">
          <h2 class="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Visão de Futuro</h2>
          
          <div class="flex items-baseline justify-between mb-6">
            <h3 class="text-lg text-white font-medium">Próximos Lançamentos</h3>
            <span v-if="!loading && upcomingTransactions.length > 0" class="text-sm font-bold text-expense">
              Total: {{ brl(upcomingTransactions.reduce((acc, t) => acc + (t.type === 'expense' ? Number(t.amount) : -Number(t.amount)), 0)) }}
            </span>
          </div>
          
          <div v-if="loading" class="space-y-4">
            <div v-for="i in 5" :key="i" class="skeleton h-12 w-full" />
          </div>
          <div v-else-if="upcomingTransactions.length === 0" class="text-center py-8">
            <span class="text-muted text-sm font-medium">Nenhum lançamento pendente.</span>
          </div>
          <ul v-else class="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            <li v-for="t in upcomingTransactions" :key="t.id" class="flex items-center justify-between group hover:bg-surface-overlay/30 p-2 -mx-2 rounded-xl transition-colors">
              <div class="flex items-center gap-3 min-w-0">
                <div class="flex flex-col items-center justify-center w-10 h-10 rounded-lg bg-surface-base border border-surface-border shrink-0">
                  <span class="text-[10px] font-bold text-muted uppercase leading-none">{{ formatDay(t.occurredAt).month }}</span>
                  <span class="text-sm font-bold text-white leading-none mt-0.5">{{ formatDay(t.occurredAt).day }}</span>
                </div>
                <div class="min-w-0 flex flex-col justify-center">
                  <span class="font-medium text-sm text-white/90 truncate">{{ t.description }}</span>
                  <div class="flex items-center gap-1.5 mt-0.5">
                    <div v-if="t.categoryId && categoriesMap.get(t.categoryId)" class="w-1.5 h-1.5 rounded-full shrink-0" :style="{ backgroundColor: categoriesMap.get(t.categoryId)?.color || '#666' }"></div>
                    <span class="text-[11px] text-muted truncate" :class="t.type === 'expense' ? 'text-expense/80' : 'text-income/80'">
                      <template v-if="t.categoryId && categoriesMap.get(t.categoryId)">
                        {{ categoriesMap.get(t.categoryId)?.name }} &bull;
                      </template>
                      {{ t.type === 'expense' ? 'Despesa' : 'Receita' }} pendente
                    </span>
                  </div>
                </div>
              </div>
              <span class="tabular-nums font-semibold text-sm shrink-0" :class="t.type === 'expense' ? 'text-expense' : 'text-income'">
                {{ t.type === 'expense' && !t.amount.toString().startsWith('-') ? '-' : '' }}{{ brl(t.amount) }}
              </span>
            </li>
          </ul>
        </div>
      </section>
    </div>

    <NewAccountModal
      :open="showEditAccount"
      :account="editingAccount"
      @close="handleCloseAccount"
      @created="loadData"
    />
  </AppShell>
</template>
