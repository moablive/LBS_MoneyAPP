<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api } from '@moneyapp/shared';
import AppShell from '../components/AppShell.vue';
import SubscriptionModal from '../components/SubscriptionModal.vue';
import type { SubscriptionSummaryResponse, SubscriptionItem } from '@moneyapp/shared';

const data = ref<SubscriptionSummaryResponse | null>(null);
const loading = ref(true);
const tab = ref<'all' | 'active' | 'inactive'>('all');
const search = ref('');

// Modal state
const showModal = ref(false);
const subscriptionToEdit = ref<SubscriptionItem | null>(null);

async function loadData() {
  loading.value = true;
  try {
    data.value = await api.get<SubscriptionSummaryResponse>('/subscriptions/summary');
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadData();
});

const filteredItems = computed(() => {
  if (!data.value) return [];
  const term = search.value.trim().toLowerCase();
  return data.value.items
    .filter((it) => {
      if (tab.value === 'active' && it.status !== 'active') return false;
      if (tab.value === 'inactive' && it.status === 'active') return false;
      if (term && !it.description.toLowerCase().includes(term)) return false;
      return true;
    })
    .sort((a, b) => b.amount - a.amount);
});

const brl = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function iconFor(item: SubscriptionItem) {
  return item.customIconUrl ?? '/banks/generic.svg';
}

function openCreateModal() {
  subscriptionToEdit.value = null;
  showModal.value = true;
}

function openEditModal(item: SubscriptionItem) {
  subscriptionToEdit.value = item;
  showModal.value = true;
}
</script>

<template>
  <AppShell>
    <div class="mx-auto max-w-7xl px-6 py-8 space-y-6">
      <header class="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight">Assinaturas e Mensalidades</h1>
          <p class="text-sm text-muted">Controle seus custos fixos e recorrentes.</p>
        </div>
        <div class="flex items-center gap-3">
          <div v-if="!loading" class="text-right hidden sm:block">
            <div class="text-[10px] uppercase tracking-wider text-muted font-medium">Gasto Mensal Total</div>
            <div class="text-xl font-semibold text-expense tabular-nums" title="Soma das despesas ativas">{{ brl(data?.gastoMensal ?? 0) }}</div>
          </div>
          <button
            @click="openCreateModal"
            class="px-3 py-2 rounded-xl bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
          >+ Nova Assinatura</button>
        </div>
      </header>

      <!-- Panel Header / Stats -->
      <section class="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div class="bg-surface-raised border border-surface-border rounded-2xl p-4 flex flex-col justify-center">
          <div class="text-[10px] uppercase tracking-wide text-muted font-semibold mb-1">Ativas</div>
          <div v-if="loading" class="skeleton h-8 w-16" />
          <div v-else class="text-2xl font-bold tabular-nums text-white">{{ data?.activeCount ?? 0 }}</div>
        </div>
        <div class="bg-surface-raised border border-surface-border rounded-2xl p-4 flex flex-col justify-center">
          <div class="text-[10px] uppercase tracking-wide text-muted font-semibold mb-1">Inativas</div>
          <div v-if="loading" class="skeleton h-8 w-16" />
          <div v-else class="text-2xl font-bold tabular-nums text-white">{{ (data?.totalCount ?? 0) - (data?.activeCount ?? 0) }}</div>
        </div>
        <div class="bg-surface-raised border border-surface-border rounded-2xl p-4 flex flex-col justify-center sm:text-right">
          <div class="text-[10px] uppercase tracking-wide text-muted font-semibold mb-1">Projeção Mensal</div>
          <div v-if="loading" class="skeleton h-8 w-24 sm:ml-auto" />
          <div v-else class="text-2xl font-bold tabular-nums text-expense">{{ brl(data?.gastoMensal ?? 0) }}</div>
        </div>
        <div class="bg-surface-raised border border-surface-border rounded-2xl p-4 flex flex-col justify-center sm:text-right">
          <div class="text-[10px] uppercase tracking-wide text-muted font-semibold mb-1">Projeção Anual</div>
          <div v-if="loading" class="skeleton h-8 w-24 sm:ml-auto" />
          <div v-else class="text-2xl font-bold tabular-nums text-white/90">{{ brl(data?.projecaoAnual ?? 0) }}</div>
        </div>
        <div class="bg-surface-raised border border-surface-border rounded-2xl p-4 flex flex-col justify-center sm:text-right">
          <div class="text-[10px] uppercase tracking-wide text-muted font-semibold mb-1">Por Terceiros</div>
          <div v-if="loading" class="skeleton h-8 w-24 sm:ml-auto" />
          <div v-else class="text-2xl font-bold tabular-nums text-muted">{{ brl(data?.gastoTerceiros ?? 0) }}</div>
        </div>
      </section>

      <!-- Filters -->
      <section class="flex items-center justify-between gap-4 flex-wrap bg-surface-raised border border-surface-border rounded-2xl p-2 shadow-lg">
        <div class="flex items-center gap-2">
          <button
            v-for="opt in (['all','active','inactive'] as const)"
            :key="opt"
            class="px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200"
            :class="tab === opt ? 'bg-surface-overlay text-white shadow-sm' : 'text-muted hover:text-white hover:bg-surface-overlay/50'"
            @click="tab = opt"
          >
            {{ opt === 'all' ? 'Todas' : opt === 'active' ? 'Ativas' : 'Inativas' }}
          </button>
        </div>
        <div class="relative w-full sm:w-auto flex-1 max-w-sm">
          <input
            v-model="search"
            placeholder="Buscar assinatura…"
            class="w-full bg-surface-base border border-surface-border rounded-xl pl-4 pr-4 py-2.5 text-sm text-white placeholder-muted focus:outline-none focus:ring-1 focus:ring-accent transition-shadow"
          />
        </div>
      </section>

      <!-- List -->
      <section class="space-y-3">
        <div v-if="loading" class="space-y-3">
          <div v-for="i in 5" :key="i" class="skeleton h-20 w-full rounded-2xl" />
        </div>

        <div v-else-if="filteredItems.length === 0" class="py-16 flex flex-col items-center justify-center text-center bg-surface-raised border border-surface-border rounded-2xl">
          <p class="text-muted font-medium">Nenhuma assinatura encontrada.</p>
        </div>

        <article
          v-for="item in filteredItems"
          :key="item.id"
          class="group bg-surface-raised border border-surface-border hover:border-surface-border/80 rounded-xl px-4 py-3 flex items-center justify-between gap-3 transition-all hover:shadow-sm cursor-pointer hover:bg-surface-overlay/30"
          @click="openEditModal(item)"
        >
          <!-- Icon & Info -->
          <div class="flex items-center gap-3 min-w-0 flex-1">
            <div class="w-8 h-8 rounded-lg bg-surface-base border border-surface-border p-1 flex items-center justify-center shrink-0">
              <img
                :src="iconFor(item)"
                alt=""
                class="w-full h-full object-contain rounded-md"
              />
            </div>
            
            <span class="font-medium text-sm text-white/90 truncate">{{ item.description }}</span>
            <span
              v-if="item.status === 'inactive'"
              class="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-surface-base text-muted border border-surface-border shrink-0"
            >Inativa</span>
          </div>

          <!-- Tags -->
          <div class="hidden sm:flex items-center gap-2 shrink-0">
            <div v-if="item.accountName" class="flex items-center gap-1.5 bg-surface-overlay px-2 py-0.5 rounded-full border border-surface-border text-[10px] uppercase font-semibold text-muted tracking-wide">
              <span>{{ item.accountName }}</span>
            </div>
            
            <div v-if="item.billingDay" class="flex items-center gap-1.5 bg-surface-overlay px-2 py-0.5 rounded-full border border-surface-border text-[10px] uppercase font-semibold text-muted tracking-wide">
              <span>Dia {{ item.billingDay }}</span>
            </div>
            
            <div v-if="item.categoryName" class="flex items-center gap-1.5 bg-surface-overlay px-2 py-0.5 rounded-full border border-surface-border text-[10px] uppercase font-semibold text-muted tracking-wide">
              <div class="w-1.5 h-1.5 rounded-full" :style="{ backgroundColor: item.categoryColor || '#666' }"></div>
              <span>{{ item.categoryName }}</span>
            </div>
          </div>

          <!-- Value -->
          <div class="flex items-center justify-end min-w-[5rem] shrink-0">
            <div
              class="tabular-nums font-semibold text-sm text-right"
              :class="item.type === 'expense' ? 'text-expense' : 'text-income'"
            >
              {{ brl(item.amount) }}
            </div>
          </div>
        </article>
      </section>
    </div>

    <!-- Modal -->
    <SubscriptionModal
      :show="showModal"
      :subscription-to-edit="subscriptionToEdit"
      @close="showModal = false"
      @saved="loadData"
      @deleted="loadData"
    />
  </AppShell>
</template>
