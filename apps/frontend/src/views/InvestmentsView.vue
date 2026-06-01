<script setup lang="ts">
import { ref, onMounted } from 'vue';
import AppShell from '../components/AppShell.vue';
import InvestmentModal from '../components/InvestmentModal.vue';
import { useConfirmDialog } from '../composables/useConfirmDialog';

const { confirm } = useConfirmDialog();
import { defineAsyncComponent } from 'vue';
const PiggyBankDetails = defineAsyncComponent(() => import('../components/PiggyBankDetails.vue'));
import { useInvestmentsStore } from '../stores/investments';
import { PlusIcon as Plus, ArrowTrendingUpIcon as TrendingUp, ArrowTrendingDownIcon as TrendingDown, WalletIcon as Wallet, PencilSquareIcon as Edit2, TrashIcon as Trash2 } from '@heroicons/vue/24/outline';

const store = useInvestmentsStore();
const isModalOpen = ref(false);
const editingInvestment = ref<any>(null);
const activePiggyBank = ref<any>(null);

const openPiggyBank = (inv: any) => {
  activePiggyBank.value = inv;
};

onMounted(() => {
  store.fetchInvestments();
});

const formatMoney = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const openNewModal = () => {
  editingInvestment.value = null;
  isModalOpen.value = true;
};

const openEditModal = (inv: any) => {
  editingInvestment.value = inv;
  isModalOpen.value = true;
};

const deleteInvestment = async (id: string) => {
  if (await confirm('Tem certeza que deseja remover este investimento?')) {
    await store.deleteInvestment(id);
  }
};

const getTypeLabel = (type: string) => {
  const types: Record<string, string> = {
    stock: 'Ação',
    crypto: 'Criptomoeda',
    fixed_income: 'Renda Fixa',
    fund: 'Fundo',
    other: 'Outro',
  };
  return types[type] || type;
};
</script>

<template>
  <AppShell>
    <div class="max-w-5xl mx-auto space-y-6">
      <header class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-surface-900 dark:text-surface-50">Investimentos</h1>
          <p class="text-surface-500 text-sm mt-1">Gerencie sua carteira de aplicações</p>
        </div>
        <button
          @click="openNewModal"
          class="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <Plus class="w-5 h-5" />
          <span>Novo Investimento</span>
        </button>
      </header>

      <div v-if="store.isLoading" class="text-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
      </div>

      <template v-else>
        <!-- Resumo -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 p-4 rounded-xl shadow-sm">
            <div class="flex items-center gap-2 text-surface-500 mb-2">
              <Wallet class="w-4 h-4" />
              <h3 class="text-sm font-medium">Valor Investido</h3>
            </div>
            <p class="text-2xl font-bold text-surface-900 dark:text-surface-50">
              {{ formatMoney(store.summary.totalInvested) }}
            </p>
          </div>

          <div class="bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 p-4 rounded-xl shadow-sm">
            <div class="flex items-center gap-2 text-surface-500 mb-2">
              <TrendingUp class="w-4 h-4" />
              <h3 class="text-sm font-medium">Valor Atual</h3>
            </div>
            <p class="text-2xl font-bold text-surface-900 dark:text-surface-50">
              {{ formatMoney(store.summary.currentTotal) }}
            </p>
          </div>

          <div class="bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 p-4 rounded-xl shadow-sm">
            <div class="flex items-center gap-2 text-surface-500 mb-2">
              <span class="text-sm font-medium">Lucro/Prejuízo</span>
            </div>
            <p
              class="text-2xl font-bold"
              :class="store.summary.profitLoss >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'"
            >
              {{ formatMoney(store.summary.profitLoss) }}
            </p>
          </div>

          <div class="bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 p-4 rounded-xl shadow-sm">
            <div class="flex items-center gap-2 text-surface-500 mb-2">
              <span class="text-sm font-medium">Variação</span>
            </div>
            <div class="flex items-center gap-1 text-2xl font-bold"
              :class="store.summary.percentage >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'"
            >
              <TrendingUp v-if="store.summary.percentage >= 0" class="w-5 h-5" />
              <TrendingDown v-else class="w-5 h-5" />
              <span>{{ store.summary.percentage.toFixed(2) }}%</span>
            </div>
          </div>
        </div>

        <!-- Lista -->
        <div class="bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl overflow-hidden shadow-sm mt-6">
          <div class="overflow-x-auto">
            <table class="w-full text-sm text-left">
              <thead class="text-xs text-surface-500 bg-surface-100 dark:bg-surface-800 uppercase">
                <tr>
                  <th class="px-4 py-2 font-medium">Ativo</th>
                  <th class="px-4 py-2 font-medium text-right">Qtd</th>
                  <th class="px-4 py-2 font-medium text-right">Investido</th>
                  <th class="px-4 py-2 font-medium text-right">Atual</th>
                  <th class="px-4 py-2 font-medium text-right">Variação</th>
                  <th class="px-4 py-2 font-medium text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="store.items.length === 0">
                  <td colspan="6" class="px-6 py-8 text-center text-surface-500">
                    Nenhum investimento cadastrado.
                  </td>
                </tr>
                <tr
                  v-for="inv in store.items"
                  :key="inv.id"
                  class="border-b border-surface-200 dark:border-surface-800 last:border-0 hover:bg-surface-100 dark:hover:bg-surface-800/50 transition-colors"
                >
                  <td class="px-4 py-2.5">
                    <div class="font-medium text-surface-900 dark:text-surface-50">{{ inv.name }}</div>
                    <div class="text-xs text-surface-500">{{ getTypeLabel(inv.type) }}</div>
                  </td>
                  <td class="px-4 py-2.5 text-right">
                    {{ Number(inv.quantity).toLocaleString('pt-BR') }}
                  </td>
                  <td class="px-4 py-2.5 text-right">
                    {{ formatMoney(Number(inv.quantity) * Number(inv.buyPrice)) }}
                  </td>
                  <td class="px-4 py-2.5 text-right font-medium">
                    {{ formatMoney(Number(inv.quantity) * Number(inv.currentPrice)) }}
                  </td>
                  <td class="px-4 py-2.5 text-right">
                    <span
                      :class="(Number(inv.currentPrice) - Number(inv.buyPrice)) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'"
                      class="font-medium inline-flex items-center gap-1"
                    >
                      {{ ((Number(inv.currentPrice) - Number(inv.buyPrice)) / Number(inv.buyPrice) * 100).toFixed(2) }}%
                    </span>
                  </td>
                  <td class="px-4 py-2.5">
                    <div class="flex items-center justify-center gap-2">
                      <button v-if="inv.type === 'fixed_income'" @click="openPiggyBank(inv)" class="p-1.5 text-surface-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-md transition-colors" title="Detalhes do Cofrinho">
                        <TrendingUp class="w-4 h-4" />
                      </button>
                      <button @click="openEditModal(inv)" class="p-1.5 text-surface-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-md transition-colors" title="Editar">
                        <Edit2 class="w-4 h-4" />
                      </button>
                      <button @click="deleteInvestment(inv.id)" class="p-1.5 text-surface-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors" title="Excluir">
                        <Trash2 class="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>

      <InvestmentModal
        v-if="isModalOpen"
        :investment="editingInvestment"
        @close="isModalOpen = false"
      />

      <PiggyBankDetails
        v-if="activePiggyBank"
        :investment="activePiggyBank"
        @close="activePiggyBank = null"
      />
    </div>
  </AppShell>
</template>
