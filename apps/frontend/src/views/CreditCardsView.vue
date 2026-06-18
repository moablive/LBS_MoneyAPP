<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue';
import { api } from '@moneyapp/api-client';
import AppShell from '../components/AppShell.vue';
import NewAccountModal from '../components/modals/NewAccountModal.vue';
import PayInvoiceModal from '../components/modals/PayInvoiceModal.vue';
import { useConfirmDialog } from '../composables/useConfirmDialog';

const { confirm } = useConfirmDialog();
import type { Account } from '@moneyapp/models';

const items = shallowRef<Account[]>([]);
const loading = ref(true);
const showCreate = ref(false);
const showPayInvoice = ref(false);
const editingAccount = ref<Account | null>(null);
const payingAccount = ref<Account | null>(null);

function editAccount(a: Account) {
  editingAccount.value = a;
  showCreate.value = true;
}

function payInvoice(a: Account) {
  payingAccount.value = a;
  showPayInvoice.value = true;
}

async function reload() {
  loading.value = true;
  try {
    const data = await api.get<Account[]>('/accounts');
    items.value = data.filter(a => a.type === 'credit_card');
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
  items.value.reduce((acc, a) => acc + Math.abs(Number(a.currentBalance)), 0),
);

const totalLimit = computed(() =>
  items.value.reduce((acc, a) => acc + (Number(a.creditLimit) || 0), 0),
);


</script>

<template>
  <AppShell>
    <div class="mx-auto max-w-7xl px-6 py-8 space-y-6">
      <header class="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight">Cartões de Crédito</h1>
          <p class="text-sm text-muted">Gerencie seus cartões, faturas e limites.</p>
        </div>
        <button
          class="px-3 py-2 rounded-xl bg-accent text-white text-sm font-medium"
          @click="showCreate = true"
        >+ Novo Cartão</button>
      </header>

      <!-- Total balance card -->
      <section class="card flex items-center justify-between gap-4">
        <div>
          <div class="text-xs uppercase tracking-wide text-muted">Faturas Abertas (Usado)</div>
          <div class="mt-1 text-3xl font-semibold tabular-nums text-expense">{{ brl(totalBalance) }}</div>
          <div class="text-sm text-muted mt-1">Limite Total: {{ brl(totalLimit) }}</div>
        </div>
        <div class="text-right text-sm text-muted">
          <div>{{ items.length }} {{ items.length === 1 ? 'cartão' : 'cartões' }}</div>
        </div>
      </section>

      <section v-if="loading" class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div v-for="i in 6" :key="i" class="skeleton h-24 w-full" />
      </section>

      <section v-else-if="items.length === 0" class="card text-center py-12 text-muted">
        Nenhum cartão cadastrado ainda.
        <div class="mt-3">
          <button class="px-3 py-2 rounded-xl bg-accent text-white text-sm font-medium"
                  @click="showCreate = true">Adicionar primeiro cartão</button>
        </div>
      </section>

      <section v-else class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <article
          v-for="a in items"
          :key="a.id"
          v-memo="[a.id, a.currentBalance, a.name, a.customIconUrl, a.type]"
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
              <div class="text-[10px] text-muted uppercase font-semibold tracking-wide" v-if="a.closingDay">
                Vence dia {{ a.dueDay || a.closingDay }}
              </div>
            </div>
            
            <div class="mt-2 w-full bg-surface-overlay h-1.5 rounded-full overflow-hidden border border-surface-border" v-if="a.creditLimit && Number(a.creditLimit) > 0">
              <div class="bg-expense h-full transition-all" :style="{ width: Math.min(100, Math.max(0, (Math.abs(Number(a.currentBalance)) / Number(a.creditLimit)) * 100)) + '%' }"></div>
            </div>
            
            <div class="mt-1 flex justify-between items-center w-full">
              <div class="text-base font-semibold tabular-nums text-expense">
                {{ brl(Math.abs(Number(a.currentBalance))) }}
              </div>
              <div class="text-[10px] text-muted" v-if="a.creditLimit && Number(a.creditLimit) > 0">
                Livre: {{ brl(Number(a.creditLimit) - Math.abs(Number(a.currentBalance))) }}
              </div>
            </div>
          </div>
          <div class="flex items-center gap-2 opacity-0 group-[.hover]:opacity-100 group-hover:opacity-100 transition-opacity">
            <button
              class="bg-accent/15 text-accent hover:bg-accent hover:text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1.5 rounded-lg transition-colors"
              title="Pagar Fatura"
              @click.stop="payInvoice(a)"
            >
              Pagar Fatura
            </button>
            <button
              class="text-muted hover:text-expense p-1.5 rounded-lg shrink-0"
              title="Remover"
              @click.stop="remove(a.id)"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </article>
      </section>
    </div>

    <NewAccountModal
      v-model:open="showCreate"
      :account="editingAccount"
      @update:open="val => { if (!val) editingAccount = null; }"
      @created="reload"
    />

    <PayInvoiceModal
      v-model:open="showPayInvoice"
      :creditCard="payingAccount"
      @update:open="val => { if (!val) payingAccount = null; }"
      @paid="reload"
    />
  </AppShell>
</template>
