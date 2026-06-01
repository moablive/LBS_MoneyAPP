<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, triggerRef } from 'vue';
import { api } from '@moneyapp/api-client';
import AppShell from '../components/AppShell.vue';
import NewTransactionModal from '../components/NewTransactionModal.vue';
import TransactionDetailsModal from '../components/TransactionDetailsModal.vue';
import { BuildingLibraryIcon as Landmark, CheckCircleIcon as CheckCircle2, ClockIcon as Clock, PaperClipIcon as Paperclip } from '@heroicons/vue/24/outline';
import type { TransactionType, Transaction, Account, Category } from '@moneyapp/models';
import { useConfirmDialog } from '../composables/useConfirmDialog';

const { confirm, alert } = useConfirmDialog();

const rows = shallowRef<Transaction[]>([]);
const accounts = ref<Account[]>([]);
const categories = ref<Category[]>([]);
const loading = ref(true);
const showCreate = ref(false);
const createType = ref<TransactionType>('expense');
const filterType = ref<'all' | TransactionType>('all');
const filterCategory = ref<string>('all');
const filterPeriod = ref<'current_month' | 'next_month' | 'all'>('current_month');
const selectedRow = ref<Transaction | null>(null);
const editingRow = ref<Transaction | null>(null);

async function reload() {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    if (filterType.value !== 'all') params.set('type', filterType.value);
    if (filterCategory.value !== 'all') params.set('categoryId', filterCategory.value);
    
    if (filterPeriod.value === 'current_month') {
      const now = new Date();
      params.set('month', `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    } else if (filterPeriod.value === 'next_month') {
      const now = new Date();
      const nm = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      params.set('month', `${nm.getFullYear()}-${String(nm.getMonth() + 1).padStart(2, '0')}`);
    } else {
      params.set('limit', '200'); // Todo período
    }
    
    const q = params.toString() ? `?${params.toString()}` : '';
    rows.value = await api.get<Transaction[]>(`/transactions${q}`);
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  loading.value = true;
  try {
    const [accs, cats] = await Promise.all([
      api.get<Account[]>('/accounts'),
      api.get<Category[]>('/categories')
    ]);
    accounts.value = accs;
    categories.value = cats;
  } catch(e) {
    console.error('Failed to load accounts or categories', e);
  }
  await reload();
});

const accountsMap = computed(() => {
  return new Map(accounts.value.map(a => [a.id, a]));
});

const categoriesMap = computed(() => {
  return new Map(categories.value.map(c => [c.id, c]));
});

const grouped = computed(() => {
  const map = new Map<string, Transaction[]>();
  for (const r of rows.value) {
    const day = r.occurredAt.slice(0, 10);
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(r);
  }
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
});

const brl = (n: number | string) =>
  Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatDay = (iso: string) => {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  const day = String(d.getUTCDate()).padStart(2, '0');
  const monthNum = String(d.getUTCMonth() + 1).padStart(2, '0');
  let monthName = d.toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' });
  monthName = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  return `${day}/${monthNum} - ${monthName}`;
};

async function toggleStatus(t: Transaction, e: Event) {
  e.stopPropagation();
  
  if (t.status === 'pending' && !t.hasReceipt) {
    await alert('É necessário anexar um comprovante para marcar a transação como paga.');
    return;
  }
  
  loading.value = true;
  try {
    await api.patch(`/transactions/${t.id}`, { status: t.status === 'paid' ? 'pending' : 'paid' });
    const idx = rows.value.findIndex(r => r.id === t.id);
    const r = rows.value[idx];
    if (r) {
      r.status = t.status === 'paid' ? 'pending' : 'paid';
      triggerRef(rows);
    } else {
      await reload();
    }
  } catch (err) {
    console.error('Failed to toggle status', err);
    loading.value = false;
  }
}

async function handleDelete(t: Transaction | null) {
  if (!t) return;
  if (!(await confirm('Tem certeza que deseja excluir esta transação?'))) return;
  
  loading.value = true;
  selectedRow.value = null;
  try {
    await api.delete(`/transactions/${t.id}`);
    await reload();
  } catch (e) {
    console.error('Failed to delete transaction', e);
    loading.value = false;
  }
}
</script>

<template>
  <AppShell>
    <div class="mx-auto max-w-7xl px-4 py-8 space-y-6">
      <header class="flex items-center justify-between gap-4 flex-wrap mb-8">
        <h1 class="text-2xl font-bold tracking-tight text-white">Livro Caixa</h1>
        <div class="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <div class="inline-flex rounded-xl border border-surface-border bg-surface-raised p-1 shadow-lg">
            <button
              v-for="opt in (['all','expense','income'] as const)"
              :key="opt"
              class="px-4 py-1.5 text-sm font-medium rounded-lg transition-colors duration-200"
              :class="filterType === opt ? 'bg-surface-overlay text-white shadow' : 'text-muted hover:text-white'"
              @click="filterType = opt; reload()"
            >
              {{ opt === 'all' ? 'Tudo' : opt === 'expense' ? 'Despesas' : 'Receitas' }}
            </button>
          </div>
          <select
            v-model="filterPeriod"
            @change="reload()"
            class="flex-1 sm:flex-none min-w-0 px-4 py-2 rounded-xl border border-surface-border bg-surface-raised text-sm font-medium text-white shadow-lg focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
          >
            <option value="current_month">Mês Atual</option>
            <option value="next_month">Próximo Mês</option>
            <option value="all">Todo Período</option>
          </select>
          <select
            v-model="filterCategory"
            @change="reload()"
            class="flex-1 sm:flex-none min-w-0 px-4 py-2 rounded-xl border border-surface-border bg-surface-raised text-sm font-medium text-white shadow-lg focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
          >
            <option value="all">Todas Categorias</option>
            <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
          </select>
          <div class="flex items-center gap-2 w-full sm:w-auto">
            <button
              class="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-expense/10 text-expense border border-expense/30 text-sm font-bold shadow-lg hover:bg-expense/20 transition-all hover:-translate-y-0.5 whitespace-nowrap"
              @click="showCreate = true; createType = 'expense'"
            >+ Despesa</button>
            <button
              class="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-income/10 text-income border border-income/30 text-sm font-bold shadow-lg hover:bg-income/20 transition-all hover:-translate-y-0.5 whitespace-nowrap"
              @click="showCreate = true; createType = 'income'"
            >+ Receita</button>
          </div>
        </div>
      </header>

      <section v-if="loading" class="space-y-4">
        <div v-for="i in 6" :key="i" class="skeleton h-20 w-full rounded-2xl" />
      </section>

      <section v-else class="space-y-8">
        <div v-if="rows.length === 0" class="py-16 flex flex-col items-center justify-center text-center bg-surface-raised border border-surface-border rounded-2xl">
          <Landmark class="w-12 h-12 text-muted/50 mb-4" />
          <p class="text-muted font-medium">Nenhuma transação encontrada no período.</p>
        </div>

        <div v-for="[day, list] in grouped" :key="day" class="bg-surface-raised border border-surface-border rounded-xl overflow-hidden shadow-sm">
          <div class="flex justify-between items-center bg-surface-overlay/30 px-4 py-2 border-b border-surface-border">
            <span class="text-xs font-semibold text-muted capitalize">{{ formatDay(day) }}</span>
            <span class="tabular-nums font-bold text-xs text-muted">
              {{ brl(list.reduce((acc, r) => acc + Number(r.amount), 0)) }}
            </span>
          </div>
          <ul class="divide-y divide-surface-border/30">
            <li
              v-for="r in list"
              :key="r.id"
              v-memo="[r.id, r.status, selectedRow?.id === r.id]"
              @click="selectedRow = r"
              class="px-4 py-3 grid grid-cols-[1fr_auto] sm:grid-cols-[3fr_1.5fr_1.5fr_1fr_1fr] items-center gap-4 transition-colors hover:bg-surface-overlay/30 cursor-pointer"
            >
              <!-- Left: Account Icon & Description -->
              <div class="flex items-center justify-start gap-3 min-w-0">
                <div v-if="r.accountId && accountsMap.get(r.accountId)" 
                     class="flex items-center justify-center w-8 h-8 rounded-lg bg-surface-base border border-surface-border text-white/80 shrink-0">
                  <img v-if="accountsMap.get(r.accountId)?.customIconUrl" :src="accountsMap.get(r.accountId)?.customIconUrl ?? undefined" class="w-5 h-5 rounded-md object-contain" />
                  <Landmark v-else class="w-4 h-4 text-accent" />
                </div>
                <div v-else class="flex items-center justify-center w-8 h-8 rounded-lg bg-surface-base border border-surface-border text-muted shrink-0">
                  <Landmark class="w-4 h-4" />
                </div>
                
                <span class="font-medium text-sm text-white/90 truncate">{{ r.description }}</span>
              </div>
              
              <!-- Center: Tags (Category) -->
              <div class="hidden sm:flex items-center justify-start min-w-0">
                <div v-if="r.categoryId && categoriesMap.get(r.categoryId)" class="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-overlay border border-surface-border truncate max-w-full">
                  <div class="w-1.5 h-1.5 rounded-full shrink-0" :style="{ backgroundColor: categoriesMap.get(r.categoryId)?.color || '#666' }"></div>
                  <span class="text-[10px] uppercase font-semibold text-muted tracking-wide truncate">{{ categoriesMap.get(r.categoryId)?.name }}</span>
                </div>
              </div>

              <!-- Center: Account Name -->
              <div class="hidden sm:flex items-center justify-start min-w-0">
                <div v-if="r.accountId && accountsMap.get(r.accountId)" class="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-overlay border border-surface-border truncate max-w-full">
                  <Landmark class="w-2.5 h-2.5 text-muted shrink-0" />
                  <span class="text-[10px] uppercase font-semibold text-muted tracking-wide truncate">{{ accountsMap.get(r.accountId)?.name }}</span>
                </div>
              </div>
              
              <!-- Right: Status & Receipt -->
              <div class="hidden sm:flex items-center justify-start gap-3 min-w-0">
                <button 
                  @click="(e) => toggleStatus(r, e)"
                  class="flex items-center justify-center gap-1 text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-md hover:opacity-80 transition-opacity w-[72px] shrink-0"
                  :class="r.status === 'paid' ? 'bg-income/10 text-income border border-income/20' : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'"
                >
                  <CheckCircle2 v-if="r.status === 'paid'" class="w-2.5 h-2.5" />
                  <Clock v-else class="w-2.5 h-2.5" />
                  {{ r.status === 'paid' ? 'Pago' : 'Pendente' }}
                </button>
                <Paperclip 
                  v-if="r.hasReceipt"
                  class="w-4 h-4 text-white/50 hover:text-white transition-colors shrink-0" 
                  title="Comprovante Anexado"
                />
              </div>

              <div
                class="hidden sm:block tabular-nums font-semibold text-sm text-right truncate"
                :class="r.type === 'expense' ? 'text-expense' : 'text-income'"
              >
                {{ r.type === 'expense' && !r.amount.toString().startsWith('-') ? '-' : '' }}{{ brl(r.amount) }}
              </div>

              <div class="flex sm:hidden items-center justify-end gap-3 min-w-0 shrink-0">
                <div
                  class="tabular-nums font-semibold text-sm text-right"
                  :class="r.type === 'expense' ? 'text-expense' : 'text-income'"
                >
                  {{ r.type === 'expense' && !r.amount.toString().startsWith('-') ? '-' : '' }}{{ brl(r.amount) }}
                </div>
                <button 
                  @click="(e) => toggleStatus(r, e)"
                  class="flex items-center justify-center gap-1 text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-md hover:opacity-80 transition-opacity w-[72px] shrink-0"
                  :class="r.status === 'paid' ? 'bg-income/10 text-income border border-income/20' : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'"
                >
                  <CheckCircle2 v-if="r.status === 'paid'" class="w-2.5 h-2.5" />
                  <Clock v-else class="w-2.5 h-2.5" />
                  {{ r.status === 'paid' ? 'Pago' : 'Pendente' }}
                </button>
              </div>
            </li>
          </ul>
        </div>
      </section>
    </div>

    <NewTransactionModal
      v-model:open="showCreate"
      :transaction="editingRow"
      :defaultType="createType"
      @created="reload"
    />

    <TransactionDetailsModal
      :open="!!selectedRow"
      @update:open="(val) => { if (!val) selectedRow = null; }"
      :transaction="selectedRow"
      :accountName="selectedRow?.accountId ? accountsMap.get(selectedRow.accountId)?.name : undefined"
      :categoryName="selectedRow?.categoryId ? categoriesMap.get(selectedRow.categoryId)?.name : undefined"
      :categoryColor="selectedRow?.categoryId ? (categoriesMap.get(selectedRow.categoryId)?.color || undefined) : undefined"
      @edit="editingRow = selectedRow; selectedRow = null; showCreate = true"
      @delete="handleDelete(selectedRow)"
    />
  </AppShell>
</template>
