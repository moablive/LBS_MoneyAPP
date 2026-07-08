<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api } from '@moneyapp/api-client';
import AppShell from '../components/AppShell.vue';
import SubscriptionModal from '../components/modals/SubscriptionModal.vue';
import type { SubscriptionSummaryResponse, SubscriptionItem } from '@moneyapp/models';

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

async function toggleStatus(item: SubscriptionItem) {
  const newStatus = item.status === 'active' ? 'inactive' : 'active';
  const oldStatus = item.status;
  item.status = newStatus;
  try {
    await api.put(`/subscriptions/${item.id}`, {
      status: newStatus
    });
    loadData();
  } catch (e) {
    console.error(e);
    item.status = oldStatus;
  }
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
            <div class="text-xl font-semibold text-expense tabular-nums" title="Soma das despesas ativas">{{ brl((data?.gastoMensal ?? 0) + (data?.gastoTerceiros ?? 0)) }}</div>
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
          <div v-else class="text-2xl font-bold tabular-nums text-expense">{{ brl((data?.gastoMensal ?? 0) + (data?.gastoTerceiros ?? 0)) }}</div>
        </div>
        <div class="bg-surface-raised border border-surface-border rounded-2xl p-4 flex flex-col justify-center sm:text-right">
          <div class="text-[10px] uppercase tracking-wide text-muted font-semibold mb-1">Projeção Anual</div>
          <div v-if="loading" class="skeleton h-8 w-24 sm:ml-auto" />
          <div v-else class="text-2xl font-bold tabular-nums text-white/90">{{ brl(((data?.gastoMensal ?? 0) + (data?.gastoTerceiros ?? 0)) * 12) }}</div>
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

        <template v-else>
          <div class="hidden sm:grid grid-cols-[1.5fr_2fr_1.5fr_1fr_auto] gap-4 px-4 py-2 bg-surface-base border border-surface-border rounded-xl text-[10px] font-bold text-muted uppercase tracking-wider">
            <div>Banco</div>
            <div>Descrição</div>
            <div>Categoria</div>
            <div>Vencimento</div>
            <div class="text-right pr-12">Valor</div>
          </div>

          <article
            v-for="item in filteredItems"
            :key="item.id"
            class="group bg-surface-raised border border-surface-border hover:border-surface-border/80 rounded-xl px-4 py-3 grid grid-cols-[1fr_auto] sm:grid-cols-[1.5fr_2fr_1.5fr_1fr_auto] items-center gap-4 transition-all hover:shadow-sm cursor-pointer hover:bg-surface-overlay/30"
            @click="openEditModal(item)"
          >
          <!-- Mobile Left: Icon & Description -->
          <div class="flex sm:hidden items-center gap-3 min-w-0">
            <div class="w-8 h-8 rounded-lg bg-surface-base border border-surface-border p-1 flex items-center justify-center shrink-0">
              <img
                :src="iconFor(item)"
                alt=""
                class="w-full h-full object-contain rounded-md"
              />
            </div>
            <div class="flex flex-col min-w-0">
              <span class="font-medium text-sm text-white/90 truncate">{{ item.description }}</span>
              <span
                v-if="item.status === 'inactive'"
                class="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 mt-0.5 rounded-md bg-surface-base text-muted border border-surface-border shrink-0 w-max"
              >Inativa</span>
            </div>
          </div>

          <!-- Desktop Col 1: Banco -->
          <div class="hidden sm:flex items-center justify-start gap-2 min-w-0">
            <div class="w-6 h-6 rounded bg-surface-base border border-surface-border p-0.5 flex items-center justify-center shrink-0">
              <img :src="iconFor(item)" alt="" class="w-full h-full object-contain rounded-sm" />
            </div>
            <span class="text-[10px] font-semibold uppercase text-muted tracking-wide truncate">{{ item.accountName || 'N/A' }}</span>
          </div>

          <!-- Desktop Col 2: Descrição -->
          <div class="hidden sm:flex items-center justify-start gap-2 min-w-0">
            <span class="font-medium text-sm text-white/90 truncate">{{ item.description }}</span>
            <span
              v-if="item.status === 'inactive'"
              class="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-surface-base text-muted border border-surface-border shrink-0"
            >Inativa</span>
          </div>

          <!-- Desktop Col 3: Categoria -->
          <div class="hidden sm:flex items-center justify-start min-w-0">
            <div v-if="item.categoryName" class="flex items-center gap-1.5 bg-surface-overlay px-2 py-0.5 rounded-full border border-surface-border text-[10px] uppercase font-semibold text-muted tracking-wide truncate max-w-full">
              <div class="w-1.5 h-1.5 rounded-full shrink-0" :style="{ backgroundColor: item.categoryColor || '#666' }"></div>
              <span class="truncate">{{ item.categoryName }}</span>
            </div>
          </div>

          <!-- Desktop Col 4: Vencimento -->
          <div class="hidden sm:flex items-center justify-start min-w-0">
            <div v-if="item.billingDay" class="flex items-center gap-1.5 bg-surface-overlay px-2 py-0.5 rounded-full border border-surface-border text-[10px] uppercase font-semibold text-muted tracking-wide truncate max-w-full">
              <span class="truncate">Dia {{ item.billingDay }}</span>
            </div>
          </div>

          <!-- Value & Toggle -->
          <div class="hidden sm:flex items-center justify-end gap-4 min-w-0">
            <div class="tabular-nums font-semibold text-sm text-right truncate" :class="item.type === 'expense' ? 'text-expense' : 'text-income'">
              {{ brl(item.amount) }}
            </div>
            <button
              @click.stop="toggleStatus(item)"
              class="w-8 h-4 rounded-full transition-colors relative shrink-0"
              :class="item.status === 'active' ? 'bg-accent' : 'bg-surface-border'"
              title="Ativar/Desativar no Dashboard"
            >
              <div
                class="absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform"
                :class="item.status === 'active' ? 'translate-x-4' : 'translate-x-0'"
              ></div>
            </button>
          </div>

          <!-- Mobile view right side -->
          <div class="flex sm:hidden items-center justify-end min-w-0 shrink-0 gap-3">
            <div
              class="tabular-nums font-semibold text-sm text-right"
              :class="item.type === 'expense' ? 'text-expense' : 'text-income'"
            >
              {{ brl(item.amount) }}
            </div>
            <button
              @click.stop="toggleStatus(item)"
              class="w-8 h-4 rounded-full transition-colors relative shrink-0"
              :class="item.status === 'active' ? 'bg-accent' : 'bg-surface-border'"
              title="Ativar/Desativar no Dashboard"
            >
              <div
                class="absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform"
                :class="item.status === 'active' ? 'translate-x-4' : 'translate-x-0'"
              ></div>
            </button>
          </div>
        </article>
        </template>
      </section>
    </div>

    <!-- Modal -->
    <SubscriptionModal
      v-model:show="showModal"
      :subscription-to-edit="subscriptionToEdit"
      @saved="loadData"
      @deleted="loadData"
    />
  </AppShell>
</template>
