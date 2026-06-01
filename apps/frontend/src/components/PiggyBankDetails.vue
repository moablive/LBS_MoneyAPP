<script setup lang="ts">
import { ref, shallowRef, onMounted, computed } from 'vue';
import { XMarkIcon as X, ArrowTrendingUpIcon as TrendingUp, ArrowDownTrayIcon as Download, ArrowUpTrayIcon as Upload } from '@heroicons/vue/24/outline';
import Modal from './Modal.vue';
import { api } from '@moneyapp/api-client';
import { useInvestmentsStore } from '../stores/investments';
// @ts-ignore
import VueApexCharts from 'vue3-apexcharts';
// @ts-ignore
import type { ApexOptions } from 'apexcharts';

const props = defineProps<{
  investment: any;
}>();

const emit = defineEmits(['close']);

const store = useInvestmentsStore();
const isSubmitting = ref(false);
const errorMsg = ref('');

const chartData = shallowRef<{ date: string; value: number }[]>([]);
const currentBalance = ref(0);
const yieldTotal = ref(0);

const actionType = ref<'deposit' | 'withdraw'>('deposit');
const amount = ref('');
const accounts = ref<any[]>([]);
const accountId = ref('');

const loadChart = async () => {
  try {
    const res = await api.get<{ chart: any[], currentBalance: number, yieldTotal: number }>(`/api/investments/${props.investment.id}/chart`);
    chartData.value = res.chart;
    currentBalance.value = res.currentBalance;
    yieldTotal.value = res.yieldTotal;
  } catch (err) {
    console.error(err);
  }
};

onMounted(async () => {
  accounts.value = await api.get<any[]>('/accounts');
  await loadChart();
});

const formatMoney = (val: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

const series = computed(() => [{
  name: 'Saldo',
  data: chartData.value.map(d => d.value)
}]);

const chartOptions = computed<ApexOptions>(() => ({
  chart: {
    type: 'area',
    toolbar: { show: false },
    zoom: { enabled: false }
  },
  colors: ['#10b981'],
  fill: {
    type: 'gradient',
    gradient: {
      shadeIntensity: 1,
      opacityFrom: 0.4,
      opacityTo: 0,
      stops: [0, 100]
    }
  },
  dataLabels: { enabled: false },
  stroke: { curve: 'smooth', width: 2 },
  xaxis: {
    categories: chartData.value.map(d => {
      const date = new Date(d.date);
      return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    }),
    labels: { style: { colors: '#9ca3af' } },
    axisBorder: { show: false },
    axisTicks: { show: false }
  },
  yaxis: {
    labels: {
      formatter: (val: number) => formatMoney(val),
      style: { colors: '#9ca3af' }
    }
  },
  grid: {
    borderColor: '#374151',
    strokeDashArray: 4,
    yaxis: { lines: { show: true } }
  },
  tooltip: {
    theme: 'dark',
    y: { formatter: (val: number) => formatMoney(val) }
  }
}));

const submitAction = async () => {
  if (!amount.value || Number(amount.value) <= 0) return;
  
  try {
    isSubmitting.value = true;
    errorMsg.value = '';
    
    if (actionType.value === 'deposit') {
      await store.depositToPiggyBank(props.investment.id, Number(amount.value), accountId.value || undefined);
    } else {
      await store.withdrawFromPiggyBank(props.investment.id, Number(amount.value), accountId.value || undefined);
    }
    
    amount.value = '';
    await loadChart();
  } catch (e: any) {
    errorMsg.value = e.message || 'Erro ao processar transação';
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <Modal :open="true" @close="$emit('close')">
    <div class="w-full max-w-2xl bg-surface-base rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90dvh]">
      <div class="px-6 py-4 border-b border-surface-200 dark:border-surface-800 flex items-center justify-between shrink-0">
        <h2 class="text-xl font-semibold text-surface-900 dark:text-surface-50 flex items-center gap-2">
          💰 {{ props.investment.name }}
        </h2>
        <button
          @click="$emit('close')"
          class="p-2 text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-full transition-colors"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="p-6 overflow-y-auto space-y-6">
        <!-- Resumo -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="p-4 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl">
            <p class="text-sm text-surface-500 mb-1">Saldo Total</p>
            <p class="text-2xl font-bold text-surface-900 dark:text-surface-50">{{ formatMoney(currentBalance) }}</p>
          </div>
          <div class="p-4 bg-primary-50 dark:bg-primary-900/10 border border-primary-100 dark:border-primary-900/30 rounded-xl">
            <p class="text-sm text-primary-600 dark:text-primary-400 mb-1">Rendimento (Total)</p>
            <p class="text-2xl font-bold text-primary-700 dark:text-primary-300 flex items-center gap-2">
              <TrendingUp class="w-5 h-5" />
              +{{ formatMoney(yieldTotal) }}
            </p>
          </div>
        </div>

        <!-- Gráfico -->
        <div class="p-4 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl">
          <h3 class="text-sm font-medium text-surface-700 dark:text-surface-300 mb-4">Evolução do Patrimônio</h3>
          <div class="h-64">
            <VueApexCharts
              v-if="chartData.length > 0"
              type="area"
              height="100%"
              :options="chartOptions"
              :series="series"
            />
            <div v-else class="h-full flex items-center justify-center text-surface-500">
              Carregando gráfico...
            </div>
          </div>
        </div>

        <!-- Ações -->
        <div class="p-4 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-xl">
          <div class="flex gap-2 mb-4">
            <button
              @click="actionType = 'deposit'"
              :class="[
                'flex-1 py-2 text-sm font-medium rounded-lg transition-colors flex justify-center items-center gap-2',
                actionType === 'deposit' 
                  ? 'bg-primary-600 text-white' 
                  : 'bg-surface-200 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-300 dark:hover:bg-surface-700'
              ]"
            >
              <Download class="w-4 h-4" /> Guardar
            </button>
            <button
              @click="actionType = 'withdraw'"
              :class="[
                'flex-1 py-2 text-sm font-medium rounded-lg transition-colors flex justify-center items-center gap-2',
                actionType === 'withdraw' 
                  ? 'bg-primary-600 text-white' 
                  : 'bg-surface-200 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-300 dark:hover:bg-surface-700'
              ]"
            >
              <Upload class="w-4 h-4" /> Resgatar
            </button>
          </div>

          <div v-if="errorMsg" class="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm">
            {{ errorMsg }}
          </div>

          <form @submit.prevent="submitAction" class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Valor (R$)</label>
                <input
                  v-model="amount"
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  placeholder="0,00"
                  class="w-full px-3 py-2 bg-surface-base dark:bg-surface-950 border border-surface-200 dark:border-surface-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Conta de Origem/Destino</label>
                <select
                  v-model="accountId"
                  class="w-full px-3 py-2 bg-surface-base dark:bg-surface-950 border border-surface-200 dark:border-surface-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Nenhuma conta (Saldo avulso)</option>
                  <option v-for="acc in accounts" :key="acc.id" :value="acc.id">
                    {{ acc.name }} ({{ formatMoney(parseFloat(acc.balance)) }})
                  </option>
                </select>
              </div>
            </div>
            
            <button
              type="submit"
              :disabled="isSubmitting || !amount"
              class="w-full py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
            >
              Confirmar {{ actionType === 'deposit' ? 'Depósito' : 'Resgate' }}
            </button>
          </form>
        </div>
      </div>
    </div>
  </Modal>
</template>
