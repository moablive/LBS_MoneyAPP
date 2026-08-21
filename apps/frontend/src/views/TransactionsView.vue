<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, triggerRef, watch } from 'vue';
import { api } from '@moneyapp/api-client';
import AppShell from '../components/AppShell.vue';
import NewTransactionModal from '../components/modals/NewTransactionModal.vue';
import TransactionDetailsModal from '../components/modals/TransactionDetailsModal.vue';
import AiImportModal from '../components/modals/AiImportModal.vue';
import { BuildingLibraryIcon as Landmark, CheckCircleIcon as CheckCircle2, ClockIcon as Clock, PaperClipIcon as Paperclip, ShareIcon, SparklesIcon as Sparkles } from '@heroicons/vue/24/outline';
import { sharesClient } from '@moneyapp/api-client';
import type { TransactionType, Transaction, Account, Category } from '@moneyapp/models';
import { useConfirmDialog } from '../composables/useConfirmDialog';

const { confirm, alert } = useConfirmDialog();

const rows = shallowRef<Transaction[]>([]);
const accounts = ref<Account[]>([]);
const categories = ref<Category[]>([]);
const loading = ref(true);
const showCreate = ref(false);
const showAiImport = ref(false);
const createType = ref<TransactionType>('expense');
const filterType = ref<'all' | TransactionType>('all');
const filterCategory = ref<string>('all');
const filterAccount = ref<string>('all');
const filterPeriod = ref<'current_month' | 'next_month' | 'all'>('current_month');
const filterSearch = ref('');
const selectedRow = ref<Transaction | null>(null);
const editingRow = ref<Transaction | null>(null);
const aiInitialData = ref<Partial<Transaction> | null>(null);

function handleAiParsed(parsedData: any, file: File | null) {
  aiInitialData.value = { ...parsedData, receiptFile: file };
  editingRow.value = null;
  createType.value = parsedData.type || 'expense';
  showCreate.value = true;
}

// Reset initial data when modal closes
watch(showCreate, (val) => {
  if (!val) {
    aiInitialData.value = null;
  }
});

const shareModalOpen = ref(false);
const shareLink = ref('');
const sharePassword = ref('');

async function handleShare() {
  loading.value = true;
  try {
    const res = await sharesClient.createShareLink(filterCategory.value === 'all' ? null : filterCategory.value);
    shareLink.value = `${window.location.origin}/share/${res.token}`;
    sharePassword.value = res.password;
    shareModalOpen.value = true;
  } catch (err) {
    console.error('Failed to create share link', err);
    await alert('Erro ao gerar link de compartilhamento.');
  } finally {
    loading.value = false;
  }
}

async function copyShareInfo() {
  await navigator.clipboard.writeText(`Link: ${shareLink.value}\nSenha: ${sharePassword.value}`);
  await alert('Copiado para a área de transferência!');
}

async function reload() {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    if (filterType.value !== 'all') params.set('type', filterType.value);
    if (filterCategory.value !== 'all') params.set('categoryId', filterCategory.value);
    if (filterAccount.value !== 'all') params.set('accountId', filterAccount.value);
    
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
  window.addEventListener('transaction-created', reload);
});

onUnmounted(() => {
  window.removeEventListener('transaction-created', reload);
});

const accountsMap = computed(() => {
  return new Map(accounts.value.map(a => [a.id, a]));
});

const categoriesMap = computed(() => {
  return new Map(categories.value.map(c => [c.id, c]));
});

const normalAccounts = computed(() => accounts.value.filter(a => a.type !== 'credit_card'));
const creditCardAccounts = computed(() => accounts.value.filter(a => a.type === 'credit_card'));

const grouped = computed(() => {
  const map = new Map<string, Transaction[]>();
  
  const search = filterSearch.value.trim().toLowerCase();
  let currentRows = rows.value;
  
  if (search) {
    currentRows = currentRows.filter(r => {
      const descMatch = r.description.toLowerCase().includes(search);
      const catMatch = (categoriesMap.value.get(r.categoryId)?.name || '').toLowerCase().includes(search);
      const accMatch = (accountsMap.value.get(r.accountId)?.name || '').toLowerCase().includes(search);
      const amountMatch = String(r.amount).includes(search);
      return descMatch || catMatch || accMatch || amountMatch;
    });
  }

  // Parse any date string into a proper Date object using LOCAL timezone.
  // This ensures grouping by day and sorting within the day are both
  // consistent with the user's local clock (America/Sao_Paulo).
  const toLocalDate = (val: string): Date => {
    // Handle DD/MM/YYYY [HH:mm[:ss]] (Brazilian format)
    const brMatch = val.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
    if (brMatch) {
      const [, dd, mm, yyyy, hh, mi, ss] = brMatch;
      return new Date(+yyyy, +mm - 1, +dd, +(hh || 0), +(mi || 0), +(ss || 0));
    }
    // ISO or any other format — let the JS engine handle it.
    // ISO with 'Z' → converts from UTC to local automatically.
    // ISO without timezone → treated as local time.
    const d = new Date(val);
    return isNaN(d.getTime()) ? new Date(0) : d;
  };

  // Generate a YYYY-MM-DD key from a Date using LOCAL year/month/day.
  const localDayKey = (d: Date): string => {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  for (const r of currentRows) {
    const key = localDayKey(toLocalDate(r.occurredAt));
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }

  // Ordena os itens dentro de cada dia (Decrescente: última compra do dia no topo,
  // primeira compra do dia embaixo — facilita acompanhar o extrato conforme ele "sobe")
  for (const [, arr] of map.entries()) {
    arr.sort((a, b) => {
      return toLocalDate(b.occurredAt).getTime() - toLocalDate(a.occurredAt).getTime();
    });
  }

  // Ordena os dias (Decrescente: último dia do mês no topo, dia 01 embaixo —
  // ordem cronológica única e contínua junto com o horário dentro do dia:
  // lendo de baixo pra cima cresce a partir de 01/01 00:00 até a última compra)
  return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
});

const brl = (n: number | string) =>
  Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatDay = (dayKey: string) => {
  // dayKey is LOCAL YYYY-MM-DD — parse it as local date for display
  const [y, m, d] = dayKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const day = String(date.getDate()).padStart(2, '0');
  const monthNum = String(date.getMonth() + 1).padStart(2, '0');
  let monthName = date.toLocaleDateString('pt-BR', { month: 'long' });
  monthName = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  let weekdayName = date.toLocaleDateString('pt-BR', { weekday: 'long' });
  weekdayName = weekdayName.charAt(0).toUpperCase() + weekdayName.slice(1);
  return `${day}/${monthNum} - ${monthName} - ${weekdayName}`;
};

const formatTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const getStatusLabel = (r: Transaction) => {
  if (r.status === 'paid') {
    if (r.type === 'income') {
      return 'Entrada';
    }
    return 'Pago';
  }
  return 'Pendente';
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

// ---------- multi-select / bulk delete ---------------------------------------
const selectMode = ref(false);
const selectedIds = ref<string[]>([]);

const allVisibleIds = computed(() => grouped.value.flatMap(([, list]) => list.map(r => r.id)));
const allSelected = computed(
  () => allVisibleIds.value.length > 0 && selectedIds.value.length === allVisibleIds.value.length
);

function isSelected(id: string) {
  return selectedIds.value.includes(id);
}

function toggleSelect(id: string) {
  const i = selectedIds.value.indexOf(id);
  if (i === -1) selectedIds.value.push(id);
  else selectedIds.value.splice(i, 1);
}

function toggleSelectMode() {
  selectMode.value = !selectMode.value;
  if (!selectMode.value) selectedIds.value = [];
}

function toggleSelectAll() {
  if (allSelected.value) selectedIds.value = [];
  else selectedIds.value = [...allVisibleIds.value];
}

function onRowClick(r: Transaction) {
  if (selectMode.value) toggleSelect(r.id);
  else selectedRow.value = r;
}

async function handleBulkDelete() {
  const ids = [...selectedIds.value];
  if (ids.length === 0) return;
  if (!(await confirm(`Excluir ${ids.length} transação(ões) selecionada(s)? Esta ação não pode ser desfeita.`))) return;

  loading.value = true;
  try {
    await api.post('/transactions/bulk-delete', { ids });
    selectedIds.value = [];
    selectMode.value = false;
    await reload();
  } catch (e) {
    console.error('Failed to bulk delete transactions', e);
    loading.value = false;
    await alert('Erro ao excluir as transações selecionadas.');
  }
}
</script>

<template>
  <AppShell>
    <div class="mx-auto max-w-7xl px-4 py-8 space-y-6">
      <header class="flex items-center justify-between gap-4 flex-wrap mb-8">
        <h1 class="text-2xl font-bold tracking-tight text-white">Livro Caixa <span class="text-sm text-accent">(v5)</span></h1>
        <div class="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <div class="order-3 sm:order-1 flex sm:inline-flex w-full sm:w-auto rounded-xl border border-surface-border bg-surface-raised p-1 shadow-lg">
            <button
              v-for="opt in (['all','expense','income'] as const)"
              :key="opt"
              class="flex-1 sm:flex-none px-4 py-1.5 text-sm font-medium rounded-lg transition-colors duration-200"
              :class="filterType === opt ? 'bg-surface-overlay text-white shadow' : 'text-muted hover:text-white'"
              @click="filterType = opt; reload()"
            >
              {{ opt === 'all' ? 'Tudo' : opt === 'expense' ? 'Despesas' : 'Receitas' }}
            </button>
          </div>
          <select
            v-model="filterPeriod"
            @change="reload()"
            class="order-1 sm:order-2 flex-1 sm:flex-none min-w-0 px-4 py-2 rounded-xl border border-surface-border bg-surface-raised text-sm font-medium text-white shadow-lg focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
          >
            <option value="current_month">Mês Atual</option>
            <option value="next_month">Próximo Mês</option>
            <option value="all">Todo Período</option>
          </select>
          <select
            v-model="filterCategory"
            @change="reload()"
            class="order-2 sm:order-3 flex-1 sm:flex-none min-w-0 px-4 py-2 rounded-xl border border-surface-border bg-surface-raised text-sm font-medium text-white shadow-lg focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
          >
            <option value="all">Todas Categorias</option>
            <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.name }}</option>
          </select>
          <select
            v-model="filterAccount"
            @change="reload()"
            class="order-3 sm:order-4 flex-1 sm:flex-none min-w-0 px-4 py-2 rounded-xl border border-surface-border bg-surface-raised text-sm font-medium text-white shadow-lg focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
          >
            <option value="all">Todas Contas</option>
            <optgroup label="Contas" v-if="normalAccounts.length > 0">
              <option v-for="acc in normalAccounts" :key="acc.id" :value="acc.id">{{ acc.name }}</option>
            </optgroup>
            <optgroup label="Cartões de Crédito" v-if="creditCardAccounts.length > 0">
              <option v-for="acc in creditCardAccounts" :key="acc.id" :value="acc.id">{{ acc.name }}</option>
            </optgroup>
          </select>
          <div class="order-4 sm:order-5 flex-1 sm:flex-none min-w-0">
            <input 
              v-model="filterSearch"
              type="text"
              placeholder="Buscar..."
              class="w-full px-4 py-2 rounded-xl border border-surface-border bg-surface-raised text-sm font-medium text-white shadow-lg focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <div class="order-6 flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
            <button
              class="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-expense/10 text-expense border border-expense/30 text-sm font-bold shadow-lg hover:bg-expense/20 transition-all hover:-translate-y-0.5 whitespace-nowrap"
              @click="editingRow = null; showCreate = true; createType = 'expense'"
            >+ Despesa</button>
            <button
              class="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-income/10 text-income border border-income/30 text-sm font-bold shadow-lg hover:bg-income/20 transition-all hover:-translate-y-0.5 whitespace-nowrap"
              @click="editingRow = null; showCreate = true; createType = 'income'"
            >+ Receita</button>
            <button
              class="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-accent/10 text-accent border border-accent/30 text-sm font-bold shadow-lg hover:bg-accent/20 transition-all hover:-translate-y-0.5 whitespace-nowrap"
              @click="showAiImport = true"
              title="Importar com IA"
            >
              <Sparkles class="w-4 h-4" /> Importar IA
            </button>
            <button
              class="flex items-center justify-center sm:flex-none px-3 py-2 rounded-xl bg-surface-overlay text-muted border border-surface-border text-sm font-bold shadow-lg hover:text-white transition-all hover:-translate-y-0.5 whitespace-nowrap"
              @click="handleShare"
              title="Compartilhar"
            >
              <ShareIcon class="w-5 h-5" />
            </button>
            <button
              class="flex-1 sm:flex-none px-4 py-2 rounded-xl border text-sm font-bold shadow-lg transition-all hover:-translate-y-0.5 whitespace-nowrap"
              :class="selectMode ? 'bg-accent/20 text-accent border-accent/40' : 'bg-surface-overlay text-muted border-surface-border hover:text-white'"
              @click="toggleSelectMode"
              title="Selecionar itens"
            >{{ selectMode ? 'Cancelar' : 'Selecionar' }}</button>
          </div>
        </div>
      </header>

      <div v-if="selectMode" class="sticky top-2 z-30 flex items-center justify-between gap-3 flex-wrap bg-surface-raised border border-accent/30 rounded-xl px-4 py-3 shadow-lg">
        <div class="flex items-center gap-4">
          <button @click="toggleSelectAll" class="text-sm font-semibold text-accent hover:text-accent/80 transition-colors">
            {{ allSelected ? 'Limpar seleção' : 'Selecionar tudo' }}
          </button>
          <span class="text-sm text-muted">{{ selectedIds.length }} selecionada(s)</span>
        </div>
        <button
          @click="handleBulkDelete"
          :disabled="selectedIds.length === 0"
          class="px-4 py-2 rounded-xl bg-expense/10 text-expense border border-expense/30 text-sm font-bold hover:bg-expense/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
        >
          Excluir selecionados
        </button>
      </div>

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
          <div class="hidden sm:grid grid-cols-[1.5fr_2fr_1fr_1fr_1.5fr_1fr_1fr] gap-4 px-4 py-2 bg-surface-base border-b border-surface-border text-[10px] font-bold text-muted uppercase tracking-wider">
            <div>Banco</div>
            <div>Descrição</div>
            <div class="text-center">Comprovante</div>
            <div>Horário</div>
            <div>Categoria</div>
            <div>Status</div>
            <div class="text-right">Valor</div>
          </div>
          <ul class="divide-y divide-surface-border/30">
            <li
              v-for="r in list"
              :key="r.id"
              v-memo="[r.id, r.status, selectedRow?.id === r.id, selectMode, isSelected(r.id)]"
              @click="onRowClick(r)"
              class="px-4 py-3 grid items-center gap-4 transition-colors hover:bg-surface-overlay/30 cursor-pointer"
              :class="[
                selectMode
                  ? 'grid-cols-[auto_1fr_auto] sm:grid-cols-[auto_1.5fr_2fr_1fr_1fr_1.5fr_1fr_1fr]'
                  : 'grid-cols-[1fr_auto] sm:grid-cols-[1.5fr_2fr_1fr_1fr_1.5fr_1fr_1fr]',
                selectMode && isSelected(r.id) ? 'bg-accent/10' : '',
              ]"
            >
              <!-- Selection checkbox -->
              <div v-if="selectMode" class="flex items-center justify-center" @click.stop="toggleSelect(r.id)">
                <input
                  type="checkbox"
                  :checked="isSelected(r.id)"
                  @change.stop="toggleSelect(r.id)"
                  class="w-4 h-4 rounded cursor-pointer accent-accent"
                />
              </div>

              <!-- Mobile Left: Icon & Description -->
              <div class="flex sm:hidden items-center justify-start gap-3 min-w-0">
                <div v-if="r.accountId && accountsMap.get(r.accountId)" 
                     class="flex items-center justify-center w-8 h-8 rounded-lg bg-surface-base border border-surface-border text-white/80 shrink-0">
                  <img v-if="accountsMap.get(r.accountId)?.customIconUrl" :src="accountsMap.get(r.accountId)?.customIconUrl ?? undefined" class="w-5 h-5 rounded-md object-contain" />
                  <Landmark v-else class="w-4 h-4 text-accent" />
                </div>
                <div v-else class="flex items-center justify-center w-8 h-8 rounded-lg bg-surface-base border border-surface-border text-muted shrink-0">
                  <Landmark class="w-4 h-4" />
                </div>
                
                <div class="flex flex-col min-w-0">
                  <span class="font-medium text-sm text-white/90 truncate">{{ r.description }}</span>
                  <span class="text-xs text-muted sm:hidden">{{ formatTime(r.occurredAt) }}</span>
                </div>
              </div>

              <!-- Desktop Col 1: Banco (Icon + Name) -->
              <div class="hidden sm:flex items-center justify-start gap-2 min-w-0">
                <div v-if="r.accountId && accountsMap.get(r.accountId)" 
                     class="flex items-center justify-center w-6 h-6 rounded bg-surface-base border border-surface-border text-white/80 shrink-0">
                  <img v-if="accountsMap.get(r.accountId)?.customIconUrl" :src="accountsMap.get(r.accountId)?.customIconUrl ?? undefined" class="w-4 h-4 rounded-sm object-contain" />
                  <Landmark v-else class="w-3 h-3 text-accent" />
                </div>
                <div v-else class="flex items-center justify-center w-6 h-6 rounded bg-surface-base border border-surface-border text-muted shrink-0">
                  <Landmark class="w-3 h-3" />
                </div>
                <span class="text-[10px] font-semibold uppercase text-muted tracking-wide truncate">{{ r.accountId && accountsMap.get(r.accountId) ? accountsMap.get(r.accountId)?.name : 'N/A' }}</span>
              </div>

              <!-- Desktop Col 2: Descrição -->
              <div class="hidden sm:flex items-center justify-start min-w-0">
                <span class="font-medium text-sm text-white/90 truncate">{{ r.description }}</span>
              </div>
              
              <!-- Desktop Col 3: Comprovante -->
              <div class="hidden sm:flex items-center justify-center min-w-0">
                <Paperclip 
                  v-if="r.hasReceipt"
                  class="w-4 h-4 text-white/50 hover:text-white transition-colors shrink-0" 
                  title="Comprovante Anexado"
                />
              </div>

              <!-- Desktop Col 4: Horário -->
              <div class="hidden sm:flex items-center justify-start min-w-0">
                <span class="text-xs font-semibold text-muted tracking-wide truncate">{{ formatTime(r.occurredAt) }}</span>
              </div>

              <!-- Desktop Col 5: Categoria -->
              <div class="hidden sm:flex items-center justify-start min-w-0">
                <div v-if="r.categoryId && categoriesMap.get(r.categoryId)" class="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-overlay border border-surface-border truncate max-w-full">
                  <div class="w-1.5 h-1.5 rounded-full shrink-0" :style="{ backgroundColor: categoriesMap.get(r.categoryId)?.color || '#666' }"></div>
                  <span class="text-[10px] uppercase font-semibold text-muted tracking-wide truncate">{{ categoriesMap.get(r.categoryId)?.name }}</span>
                </div>
              </div>

              <!-- Desktop Col 6: Status -->
              <div class="hidden sm:flex items-center justify-start min-w-0">
                <button 
                  @click="(e) => toggleStatus(r, e)"
                  class="flex items-center justify-center gap-1 text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-md hover:opacity-80 transition-opacity w-[72px] shrink-0"
                  :class="r.status === 'paid' ? 'bg-income/10 text-income border border-income/20' : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'"
                >
                  <CheckCircle2 v-if="r.status === 'paid'" class="w-2.5 h-2.5" />
                  <Clock v-else class="w-2.5 h-2.5" />
                  {{ getStatusLabel(r) }}
                </button>
              </div>

              <!-- Desktop Col 7: Valor -->
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
                  {{ getStatusLabel(r) }}
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
      :initialData="aiInitialData"
      :defaultType="createType"
      @created="reload"
      @update:open="val => { if (!val) { editingRow = null; aiInitialData = null; } }"
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

    <!-- Share Modal -->
    <div v-if="shareModalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      <div class="bg-surface-raised border border-surface-border rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-6">
        <div>
          <h3 class="text-xl font-bold text-white mb-2">Link Compartilhado Criado!</h3>
          <p class="text-sm text-muted">Este link será válido por apenas 24 horas. Guarde a senha gerada, pois ela não será exibida novamente.</p>
        </div>
        
        <div class="space-y-4">
          <div>
            <label class="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">URL</label>
            <div class="flex items-center bg-surface-overlay border border-surface-border rounded-xl px-3 py-2">
              <input type="text" readonly :value="shareLink" class="bg-transparent text-white text-sm w-full outline-none" />
            </div>
          </div>
          <div>
            <label class="block text-xs font-semibold text-muted uppercase tracking-wider mb-1.5">Senha</label>
            <div class="flex items-center bg-surface-overlay border border-surface-border rounded-xl px-3 py-2">
              <input type="text" readonly :value="sharePassword" class="bg-transparent text-white text-sm w-full outline-none font-mono" />
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-4 border-t border-surface-border/50">
          <button 
            @click="shareModalOpen = false" 
            class="px-5 py-2.5 rounded-xl border border-surface-border font-semibold text-white shadow-sm hover:bg-surface-overlay transition-colors text-sm"
          >
            Fechar
          </button>
          <button 
            @click="copyShareInfo" 
            class="px-5 py-2.5 rounded-xl bg-accent text-white font-bold shadow-lg hover:bg-accent/90 transition-colors text-sm"
          >
            Copiar Info
          </button>
        </div>
      </div>
    </div>

    <AiImportModal
      :open="showAiImport"
      @close="showAiImport = false"
      @parsed="handleAiParsed"
    />
  </AppShell>
</template>
