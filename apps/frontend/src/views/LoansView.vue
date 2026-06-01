<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '@moneyapp/shared';
import AppShell from '../components/AppShell.vue';
import LoanModal from '../components/LoanModal.vue';
import { PaperClipIcon as Paperclip } from '@heroicons/vue/24/outline';
import type { LoanSummaryResponse, LoanItem } from '@moneyapp/shared';

const route = useRoute();

const data = ref<LoanSummaryResponse | null>(null);
const loading = ref(true);
const tab = ref<'all' | 'given' | 'received' | 'fgts'>('all');
const search = ref('');

// Modal state
const showModal = ref(false);
const loanToEdit = ref<LoanItem | null>(null);

const accounts = ref<import('@moneyapp/shared').Account[]>([]);
const accountsMap = computed(() => new Map(accounts.value.map(a => [a.id, a])));

async function loadData() {
  loading.value = true;
  try {
    const [summaryData, accs] = await Promise.all([
      api.get<LoanSummaryResponse>('/loans/summary'),
      api.get<import('@moneyapp/shared').Account[]>('/accounts').catch(() => [])
    ]);
    data.value = summaryData;
    accounts.value = accs;
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadData();
});

watch(() => route.params.type, (newType) => {
  if (newType === 'receber') tab.value = 'given';
  else if (newType === 'pagar') tab.value = 'received';
  else if (newType === 'fgts') tab.value = 'fgts';
  else tab.value = 'all';
}, { immediate: true });

const filteredItems = computed(() => {
  if (!data.value) return [];
  const term = search.value.trim().toLowerCase();
  return data.value.items
    .filter((it) => {
      if (tab.value === 'given' && it.type !== 'given') return false;
      if (tab.value === 'received' && it.type !== 'received') return false;
      if (tab.value === 'fgts' && it.type !== 'fgts') return false;
      if (term && !it.description.toLowerCase().includes(term)) return false;
      return true;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
});

const brl = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatDay = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

const groupedLoans = computed(() => {
  const map = new Map<string, LoanItem[]>();
  for (const item of filteredItems.value) {
    const day = item.date.slice(0, 10);
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(item);
  }
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
});

function openCreateModal() {
  loanToEdit.value = null;
  showModal.value = true;
}

function openEditModal(item: LoanItem) {
  loanToEdit.value = item;
  showModal.value = true;
}
</script>

<template>
  <AppShell>
    <div class="mx-auto max-w-7xl px-6 py-8 space-y-6">
      <header class="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight">{{ tab === 'given' ? 'Emprestei (A Receber)' : tab === 'received' ? 'Peguei (A Pagar)' : tab === 'fgts' ? 'Governamental (FGTS)' : 'Empréstimos' }}</h1>
          <p class="text-sm text-muted">Controle seus empréstimos.</p>
        </div>
        <div class="flex items-center gap-3">
          <button
            @click="openCreateModal"
            class="px-3 py-2 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
          >+ Novo Empréstimo</button>
        </div>
      </header>

      <!-- Main Panel Stats & Filters -->
      <main class="card !p-0 overflow-hidden divide-y divide-surface-border mb-8">
        <!-- Panel Header / Stats -->
        <div class="p-4 bg-surface-raised/30 grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div>
            <div class="text-[10px] uppercase tracking-wide text-muted">Ativos</div>
            <div v-if="loading" class="skeleton h-6 w-12 mt-1" />
            <div v-else class="text-xl font-semibold tabular-nums">{{ data?.activeCount ?? 0 }}</div>
          </div>
          <div>
            <div class="text-[10px] uppercase tracking-wide text-muted">Pagos</div>
            <div v-if="loading" class="skeleton h-6 w-12 mt-1" />
            <div v-else class="text-xl font-semibold tabular-nums">{{ data?.paidCount ?? 0 }}</div>
          </div>
          <div class="sm:text-right group relative">
            <div class="text-[10px] uppercase tracking-wide text-muted">A Receber</div>
            <div v-if="loading" class="skeleton h-6 w-24 mt-1 sm:ml-auto" />
            <div v-else class="text-xl font-semibold tabular-nums text-income">{{ brl(data?.totalActiveAmountGiven ?? 0) }}</div>
          </div>
          <div class="sm:text-right group relative">
            <div class="text-[10px] uppercase tracking-wide text-muted">A Pagar</div>
            <div v-if="loading" class="skeleton h-6 w-24 mt-1 sm:ml-auto" />
            <div v-else class="text-xl font-semibold tabular-nums text-expense">{{ brl(data?.totalActiveAmountReceived ?? 0) }}</div>
          </div>
          <div class="sm:text-right group relative">
            <div class="text-[10px] uppercase tracking-wide text-muted">FGTS</div>
            <div v-if="loading" class="skeleton h-6 w-24 mt-1 sm:ml-auto" />
            <div v-else class="text-xl font-semibold tabular-nums text-blue-400">{{ brl(data?.totalActiveAmountFGTS ?? 0) }}</div>
          </div>
        </div>

        <!-- Filters -->
        <div class="p-3 flex items-center gap-3 bg-surface-overlay/20">
          <input
            v-model="search"
            placeholder="Buscar empréstimo…"
            class="flex-1 min-w-[180px] bg-surface-overlay border border-surface-border rounded-xl px-3 py-2 text-sm
                   focus:outline-none focus:ring-2 focus:ring-accent/60"
          />
        </div>
      </main>

      <!-- List -->
      <section v-if="loading" class="space-y-4">
        <div v-for="i in 3" :key="i" class="skeleton h-20 w-full rounded-2xl" />
      </section>

      <section v-else class="space-y-8">
        <div v-if="filteredItems.length === 0" class="py-16 flex flex-col items-center justify-center text-center bg-surface-raised border border-surface-border rounded-2xl">
          <p class="text-muted font-medium">Nenhum empréstimo encontrado.</p>
        </div>

        <div v-for="[day, list] in groupedLoans" :key="day" class="bg-surface-raised border border-surface-border rounded-xl overflow-hidden shadow-sm">
          <div class="flex justify-between items-center bg-surface-overlay/30 px-4 py-2 border-b border-surface-border">
            <span class="text-xs font-semibold text-muted capitalize">{{ formatDay(day) }}</span>
            <span class="tabular-nums font-bold text-xs text-muted">
              {{ brl(list.reduce((acc, r) => acc + Number(r.amount), 0)) }}
            </span>
          </div>
          <ul class="divide-y divide-surface-border/30">
            <li
              v-for="item in list"
              :key="item.id"
              class="px-4 py-3 flex items-center justify-between gap-3 transition-colors hover:bg-surface-overlay/30 cursor-pointer"
              @click="openEditModal(item)"
            >
              <!-- Left: Icon & Description -->
              <div class="flex items-center justify-start gap-3 min-w-0 flex-1">
                <div class="h-8 w-8 rounded-lg border border-surface-border shrink-0 flex items-center justify-center bg-surface-base">
                  <svg v-if="item.type === 'given'" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-income"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
                  <svg v-else-if="item.type === 'received'" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-expense"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
                  <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-400"><rect width="20" height="12" x="2" y="6" rx="2"/><path d="M12 12h.01M17 12h.01M7 12h.01"/></svg>
                </div>
                <span class="font-medium text-sm text-white/90 truncate" :class="item.status === 'paid' ? 'line-through text-muted' : ''">{{ item.description }}</span>
              </div>
              
              <!-- Center: Tags (Account) -->
              <div class="hidden sm:flex items-center justify-end gap-2 shrink-0">
                <div v-if="item.accountId && accountsMap.get(item.accountId)" class="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-surface-overlay border border-surface-border">
                  <img v-if="accountsMap.get(item.accountId)?.customIconUrl" :src="accountsMap.get(item.accountId)?.customIconUrl ?? undefined" class="w-3.5 h-3.5 rounded-sm object-contain" />
                  <span class="text-[10px] uppercase font-semibold text-muted tracking-wide">{{ accountsMap.get(item.accountId)?.name }}</span>
                </div>
              </div>
              
              <!-- Right: Receipt & Amount & Status -->
              <div class="flex items-center justify-end gap-3 min-w-0 shrink-0">
                <Paperclip
                  v-if="item.hasReceipt"
                  class="w-4 h-4 text-white/50 hover:text-white transition-colors" 
                  title="Comprovante Anexado"
                />
                <div
                  class="tabular-nums font-semibold text-sm min-w-[5rem] text-right"
                  :class="item.status === 'paid' ? 'text-muted' : (item.type === 'given' ? 'text-income' : item.type === 'fgts' ? 'text-blue-400' : 'text-expense')"
                >
                  {{ brl(item.amount) }}
                </div>
                <div 
                  class="flex items-center justify-center gap-1 text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-md transition-opacity w-[60px] shrink-0"
                  :class="item.status === 'paid' ? 'bg-income/10 text-income border border-income/20' : 'bg-surface-overlay text-muted border border-surface-border'"
                >
                  {{ item.status === 'paid' ? 'Pago' : 'Aberto' }}
                </div>
              </div>
            </li>
          </ul>
        </div>
      </section>
    </div>

    <!-- Modal -->
    <LoanModal
      :show="showModal"
      :loan-to-edit="loanToEdit"
      :default-type="tab !== 'all' ? tab : 'given'"
      @close="showModal = false"
      @saved="loadData"
      @deleted="loadData"
    />
  </AppShell>
</template>
