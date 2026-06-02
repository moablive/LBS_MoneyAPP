<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue';
import { api } from '@moneyapp/api-client';
import AppShell from '../components/AppShell.vue';
import NewAccountModal from '../components/NewAccountModal.vue';
import { useConfirmDialog } from '../composables/useConfirmDialog';

const { confirm } = useConfirmDialog();
import type { AccountType, Account } from '@moneyapp/models';

const items = shallowRef<Account[]>([]);
const loading = ref(true);
const showCreate = ref(false);
const editingAccount = ref<Account | null>(null);

function editAccount(a: Account) {
  editingAccount.value = a;
  showCreate.value = true;
}

async function reload() {
  loading.value = true;
  try {
    const data = await api.get<Account[]>('/accounts');
    items.value = data.filter(a => a.type !== 'credit_card');
  } finally {
    loading.value = false;
  }
}

async function remove(id: string) {
  if (!(await confirm('Remover esta conta? Transações vinculadas perderão a referência.'))) return;
  await api.delete(`/accounts/${id}`);
  await reload();
}

onMounted(reload);

const brl = (n: number | string) =>
  Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const totalBalance = computed(() =>
  items.value.reduce((acc, a) => acc + Number(a.currentBalance), 0),
);

const typeLabels: Record<AccountType, string> = {
  checking: 'Conta Corrente',
  savings: 'Poupança',
  credit_card: 'Cartão de Crédito',
  wallet: 'Carteira',
  investment: 'Investimento',
  other: 'Outro',
};


</script>

<template>
  <AppShell>
    <div class="mx-auto max-w-7xl px-6 py-8 space-y-6">
      <header class="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight">Contas</h1>
          <p class="text-sm text-muted">Gerencie suas contas bancárias, carteiras e cartões.</p>
        </div>
        <button
          class="px-3 py-2 rounded-xl bg-accent text-white text-sm font-medium"
          @click="showCreate = true"
        >+ Nova Conta</button>
      </header>

      <!-- Total balance card -->
      <section class="card flex items-center justify-between gap-4">
        <div>
          <div class="text-xs uppercase tracking-wide text-muted">Saldo geral</div>
          <div class="mt-1 text-3xl font-semibold tabular-nums">{{ brl(totalBalance) }}</div>
        </div>
        <div class="text-right text-sm text-muted">
          <div>{{ items.length }} {{ items.length === 1 ? 'conta' : 'contas' }}</div>
        </div>
      </section>

      <section v-if="loading" class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div v-for="i in 6" :key="i" class="skeleton h-24 w-full" />
      </section>

      <section v-else-if="items.length === 0" class="card text-center py-12 text-muted">
        Nenhuma conta cadastrada ainda.
        <div class="mt-3">
          <button class="px-3 py-2 rounded-xl bg-accent text-white text-sm font-medium"
                  @click="showCreate = true">Adicionar primeira conta</button>
        </div>
      </section>

      <section v-else class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <article
          v-for="a in items"
          :key="a.id"
          v-memo="[a.id, a.currentBalance, a.name, a.customIconUrl, a.type, a.freezeBalance]"
          class="bg-surface-raised border border-surface-border rounded-xl p-3 px-4 flex items-center gap-3 group cursor-pointer hover:bg-surface-overlay/50 transition-colors"
          @click="editAccount(a)"
        >
          <img
            :src="a.customIconUrl || '/banks/generic.svg'"
            :alt="a.name"
            class="h-10 w-10 rounded-xl shrink-0 border border-surface-border"
          />
          <div class="min-w-0 flex-1 flex flex-col justify-center">
            <div class="flex items-center gap-2">
              <div class="font-medium text-sm truncate">{{ a.name }}</div>
              <div class="text-[10px] text-muted uppercase font-semibold tracking-wide">
                {{ typeLabels[a.type] }}
              </div>
              <span
                v-if="a.freezeBalance"
                class="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/25"
                title="Conta histórica — pagamentos não alteram o saldo"
              >Histórico</span>
            </div>
            <div class="mt-0.5 text-base font-semibold tabular-nums"
                 :class="Number(a.currentBalance) < 0 ? 'text-expense' : ''">
              {{ brl(a.currentBalance) }}
            </div>
          </div>
          <button
            class="opacity-0 group-hover:opacity-100 transition-opacity
                   text-muted hover:text-expense p-1.5 rounded-lg shrink-0"
            title="Remover"
            @click.stop="remove(a.id)"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </article>
      </section>
    </div>

    <NewAccountModal
      v-model:open="showCreate"
      :account="editingAccount"
      @update:open="val => { if (!val) editingAccount = null; }"
      @created="reload"
    />
  </AppShell>
</template>
