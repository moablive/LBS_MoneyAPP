<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { api } from '@moneyapp/api-client';
import AppShell from '../components/AppShell.vue';
import NewAccountModal from '../components/modals/NewAccountModal.vue';
import SeloPessoa from '../components/SeloPessoa.vue';
import BarraLimite from '../components/BarraLimite.vue';
import { useConfirmDialog } from '../composables/useConfirmDialog';
import { useEmpresasStore } from '../stores/empresas';

const { confirm } = useConfirmDialog();
import type { AccountType, Account } from '@moneyapp/models';

const items = shallowRef<Account[]>([]);
// Cartões na seção de baixo da mesma tela (05/11/2026, pedido do dono: um lugar para todas as contas, outro para todos os cartões).
const cards = shallowRef<Account[]>([]);
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
    cards.value = data.filter(a => a.type === 'credit_card');
  } finally {
    loading.value = false;
  }
}

async function remove(id: string) {
  if (!(await confirm('Remover esta conta? Transações vinculadas perderão a referência.'))) return;
  await api.delete(`/accounts/${id}`);
  await reload();
}

// `/contas?nova=1` (botão "+ Nova conta" do balão Contas do menu) abre o cadastro direto.
const route = useRoute();
const router = useRouter();
watch(() => route.query.nova, (nova) => {
  if (nova !== '1') return;
  editingAccount.value = null;
  showCreate.value = true;
  router.replace({ query: {} });
}, { immediate: true });

const empresasStore = useEmpresasStore();
onMounted(() => {
  empresasStore.fetchEmpresas().catch(() => {});
  reload();
});

const brl = (n: number | string) =>
  Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const totalBalance = computed(() =>
  items.value.reduce((acc, a) => a.freezeBalance ? acc : acc + Number(a.currentBalance), 0),
);

const totalFaturas = computed(() =>
  cards.value.reduce((acc, a) => acc + Math.abs(Number(a.currentBalance)), 0),
);

const typeLabels: Record<AccountType, string> = {
  checking: 'Conta Corrente',
  savings: 'Poupança',
  credit_card: 'Cartão de Crédito',
  wallet: 'Carteira',
  cash: 'Dinheiro',
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
          <div v-if="cards.length">{{ cards.length }} {{ cards.length === 1 ? 'cartão' : 'cartões' }}</div>
        </div>
      </section>

      <h2 class="text-sm font-semibold uppercase tracking-wide text-muted">Contas</h2>

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
          v-memo="[a.id, a.currentBalance, a.name, a.customIconUrl, a.type, a.freezeBalance, a.empresaId, empresasStore.items.length]"
          class="bg-surface-raised border border-surface-border rounded-xl p-3 px-4 flex items-center gap-3 group cursor-pointer hover:bg-surface-overlay/50 transition-colors"
          @click="editAccount(a)"
        >
          <img
            :src="a.customIconUrl || '/banks/generic.svg'"
            :alt="a.name"
            class="h-10 w-10 rounded-xl shrink-0 border border-surface-border"
          />
          <div class="min-w-0 flex-1 flex flex-col justify-center">
            <!-- Nome com o selo PF/PJ (05/11/2026); tipo, Histórico e empresa na linha de baixo, para o nome não sumir em "PicP…". -->
            <div class="flex items-center gap-2 min-w-0">
              <div class="font-medium text-sm truncate">{{ a.name }}</div>
              <SeloPessoa :empresa-id="a.empresaId" />
            </div>
            <div class="mt-0.5 flex items-center gap-1.5 min-w-0 text-[10px] text-muted uppercase font-semibold tracking-wide">
              <span class="shrink-0">{{ typeLabels[a.type] }}</span>
              <span
                v-if="a.freezeBalance"
                class="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/25"
                title="Conta histórica — pagamentos não alteram o saldo"
              >Histórico</span>
              <span v-if="a.empresaId" class="truncate">· {{ empresasStore.nomeDe(a.empresaId) }}</span>
            </div>
            <div class="mt-0.5 text-base font-semibold tabular-nums"
                 :class="Number(a.currentBalance) < 0 ? 'text-expense' : ''">
              {{ brl(a.currentBalance) }}
            </div>
          </div>
          <!-- No celular (sem hover) Modificar e Remover ficam sempre à vista; no computador aparecem ao passar o mouse. -->
          <div class="flex items-center gap-2 sm:opacity-0 group-[.hover]:opacity-100 group-hover:opacity-100 transition-opacity">
            <button
              class="bg-accent/15 text-accent hover:bg-accent hover:text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1.5 rounded-lg transition-colors"
              title="Modificar"
              @click.stop="editAccount(a)"
            >
              Modificar
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

      <!-- Todos os cartões de crédito; faturas, pagamento e vínculos continuam na tela Cartões. -->
      <template v-if="!loading && cards.length">
        <div class="flex items-center justify-between gap-3 pt-2">
          <h2 class="text-sm font-semibold uppercase tracking-wide text-muted">
            Cartões de crédito
            <span class="normal-case tracking-normal font-normal">· faturas {{ brl(totalFaturas) }}</span>
          </h2>
          <RouterLink to="/cartoes" class="text-xs font-semibold text-accent hover:opacity-80">Faturas e pagamentos →</RouterLink>
        </div>
        <section class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <article
            v-for="a in cards"
            :key="a.id"
            v-memo="[a.id, a.currentBalance, a.name, a.customIconUrl, a.creditLimit, a.dueDay, a.closingDay, a.empresaId, empresasStore.items.length]"
            class="bg-surface-raised border border-surface-border rounded-xl p-3 px-4 flex items-center gap-3 group cursor-pointer hover:bg-surface-overlay/50 transition-colors"
            @click="editAccount(a)"
          >
            <img
              :src="a.customIconUrl || '/banks/generic.svg'"
              :alt="a.name"
              class="h-10 w-10 rounded-xl shrink-0 border border-surface-border"
            />
            <div class="min-w-0 flex-1 flex flex-col justify-center">
              <div class="flex items-center gap-2 min-w-0">
                <div class="font-medium text-sm truncate">{{ a.name }}</div>
                <SeloPessoa :empresa-id="a.empresaId" />
              </div>
              <div class="mt-0.5 flex items-center gap-1.5 min-w-0 text-[10px] text-muted uppercase font-semibold tracking-wide">
                <span v-if="a.closingDay" class="shrink-0">Vence dia {{ a.dueDay || a.closingDay }}</span>
                <span v-else class="shrink-0">{{ typeLabels[a.type] }}</span>
                <span v-if="a.empresaId" class="truncate">· {{ empresasStore.nomeDe(a.empresaId) }}</span>
              </div>
              <div class="mt-0.5 flex items-baseline justify-between gap-2">
                <div class="text-base font-semibold tabular-nums text-expense">{{ brl(Math.abs(Number(a.currentBalance))) }}</div>
                <div v-if="a.creditLimit && Number(a.creditLimit) > 0" class="text-[10px] text-muted tabular-nums">
                  Livre: {{ brl(Number(a.creditLimit) - Math.abs(Number(a.currentBalance))) }}
                </div>
              </div>
              <BarraLimite v-if="a.creditLimit && Number(a.creditLimit) > 0" class="mt-1.5" :usado="Number(a.currentBalance)" :limite="Number(a.creditLimit)" />
            </div>
            <div class="flex items-center gap-2 sm:opacity-0 group-[.hover]:opacity-100 group-hover:opacity-100 transition-opacity">
              <button
                class="bg-accent/15 text-accent hover:bg-accent hover:text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1.5 rounded-lg transition-colors"
                title="Modificar"
                @click.stop="editAccount(a)"
              >
                Modificar
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
      </template>
    </div>

    <NewAccountModal
      v-model:open="showCreate"
      :account="editingAccount"
      @update:open="val => { if (!val) editingAccount = null; }"
      @created="reload"
    />
  </AppShell>
</template>
