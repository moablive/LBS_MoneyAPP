<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { XMarkIcon as X, CheckIcon as Save } from '@heroicons/vue/24/outline';
import Modal from './Modal.vue';
import { api } from '@moneyapp/api-client';
import { useInvestmentsStore } from '../../stores/investments';

const props = defineProps<{
  investment?: any;
}>();

const emit = defineEmits(['close']);

const store = useInvestmentsStore();
const accounts = ref<any[]>([]);

const normalAccounts = computed(() => accounts.value.filter(a => a.type !== 'credit_card'));
const creditCardAccounts = computed(() => accounts.value.filter(a => a.type === 'credit_card'));

const isSubmitting = ref(false);
const errorMsg = ref('');

const form = ref({
  name: '',
  type: 'stock',
  accountId: '',
  quantity: '',
  buyPrice: '',
  currentPrice: '',
  buyDate: new Date(Date.now() - 10800000).toISOString().slice(0, 10),
  notes: '',
  goalAmount: '',
  yieldRate: '',
  yieldIndex: 'CDI',
});

onMounted(async () => {
  accounts.value = await api.get<any[]>('/accounts');

  if (props.investment) {
    form.value = {
      name: props.investment.name,
      type: props.investment.type,
      accountId: props.investment.accountId || '',
      quantity: props.investment.quantity,
      buyPrice: props.investment.buyPrice,
      currentPrice: props.investment.currentPrice,
      buyDate: new Date(props.investment.buyDate).toISOString().slice(0, 10),
      notes: props.investment.notes || '',
      goalAmount: props.investment.goalAmount || '',
      yieldRate: props.investment.yieldRate || '',
      yieldIndex: props.investment.yieldIndex || 'CDI',
    };
  }
});

const submit = async () => {
  try {
    isSubmitting.value = true;
    errorMsg.value = '';

    const payload = {
      name: form.value.name,
      type: form.value.type,
      accountId: form.value.accountId || null,
      quantity: (form.value.type === 'fixed_income' || form.value.type === 'fund') ? '1' : String(form.value.quantity),
      buyPrice: String(form.value.buyPrice),
      currentPrice: String(form.value.currentPrice || form.value.buyPrice),
      buyDate: new Date(form.value.buyDate as string).toISOString(),
      notes: form.value.notes,
      ...(form.value.type === 'fixed_income' && {
        goalAmount: form.value.goalAmount ? String(form.value.goalAmount) : null,
        yieldRate: form.value.yieldRate ? String(form.value.yieldRate) : null,
        yieldIndex: form.value.yieldIndex || null,
      }),
    };

    if (props.investment) {
      await store.updateInvestment(props.investment.id, payload);
    } else {
      await store.createInvestment(payload);
    }
    
    emit('close');
  } catch (e: any) {
    errorMsg.value = e.message || 'Erro ao salvar investimento';
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <Modal :open="true" @close="$emit('close')">
    <div class="w-full max-w-md bg-surface-base rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90dvh]">
      <div class="px-6 py-4 border-b border-surface-200 dark:border-surface-800 flex items-center justify-between shrink-0">
        <h2 class="text-lg font-semibold text-surface-900 dark:text-surface-50">
          {{ props.investment ? 'Editar Investimento' : 'Novo Investimento' }}
        </h2>
        <button
          @click="$emit('close')"
          class="p-2 text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-full transition-colors"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <div class="p-6 overflow-y-auto">
        <div v-if="errorMsg" class="mb-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm">
          {{ errorMsg }}
        </div>

        <form @submit.prevent="submit" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Nome do Ativo</label>
            <input
              v-model="form.name"
              type="text"
              required
              placeholder="Ex: PETR4, BTC, Tesouro Direto"
              class="w-full px-3 py-2 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Tipo</label>
              <select
                v-model="form.type"
                required
                class="w-full px-3 py-2 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="stock">Ação</option>
                <option value="crypto">Criptomoeda</option>
                <option value="fixed_income">Renda Fixa</option>
                <option value="fund">Fundo</option>
                <option value="other">Outro</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Data</label>
              <input
                v-model="form.buyDate"
                type="date"
                required
                class="w-full px-3 py-2 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div v-if="form.type === 'fixed_income'" class="p-4 bg-primary-50 dark:bg-primary-900/10 rounded-xl space-y-4 border border-primary-100 dark:border-primary-900/30">
            <h3 class="text-sm font-semibold text-primary-800 dark:text-primary-400">Configurações do Cofrinho</h3>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Taxa de Rendimento (%)</label>
                <input
                  v-model="form.yieldRate"
                  type="number"
                  step="any"
                  placeholder="Ex: 100"
                  class="w-full px-3 py-2 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Indexador</label>
                <select
                  v-model="form.yieldIndex"
                  class="w-full px-3 py-2 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="CDI">CDI</option>
                  <option value="IPCA">IPCA</option>
                  <option value="SELIC">SELIC</option>
                  <option value="PREFIXADO">Prefixado</option>
                </select>
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Meta de Valor (R$)</label>
              <input
                v-model="form.goalAmount"
                type="number"
                step="any"
                placeholder="Ex: 10000"
                class="w-full px-3 py-2 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div v-if="form.type !== 'fixed_income' && form.type !== 'fund'">
              <label class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Quantidade</label>
              <input
                v-model="form.quantity"
                type="number"
                step="any"
                min="0"
                required
                placeholder="0.00"
                class="w-full px-3 py-2 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div :class="form.type === 'fixed_income' || form.type === 'fund' ? 'col-span-2' : ''">
              <label class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
                {{ (form.type === 'fixed_income' || form.type === 'fund') ? 'Valor Aplicado' : 'Preço Médio / Compra' }}
              </label>
              <input
                v-model="form.buyPrice"
                type="number"
                step="any"
                min="0"
                required
                placeholder="R$ 0,00"
                class="w-full px-3 py-2 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">
              {{ (form.type === 'fixed_income' || form.type === 'fund') ? 'Saldo Atual' : 'Preço Atual' }}
            </label>
            <input
              v-model="form.currentPrice"
              type="number"
              step="any"
              min="0"
              placeholder="Opcional. Usará preço de compra se vazio"
              class="w-full px-3 py-2 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Conta Vinculada</label>
            <select
              v-model="form.accountId"
              class="w-full px-3 py-2 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Nenhuma conta</option>
              <optgroup label="Contas" v-if="normalAccounts.length > 0">
                <option v-for="acc in normalAccounts" :key="acc.id" :value="acc.id">
                  {{ acc.name }} ({{ acc.type }})
                </option>
              </optgroup>
              <optgroup label="Cartões de Crédito" v-if="creditCardAccounts.length > 0">
                <option v-for="acc in creditCardAccounts" :key="acc.id" :value="acc.id">
                  {{ acc.name }} ({{ acc.type }})
                </option>
              </optgroup>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1">Observações</label>
            <textarea
              v-model="form.notes"
              rows="2"
              class="w-full px-3 py-2 bg-surface-50 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            ></textarea>
          </div>
        </form>
      </div>

      <div class="px-6 py-4 border-t border-surface-200 dark:border-surface-800 shrink-0 flex justify-end gap-3 bg-surface-50/50 dark:bg-surface-900/50">
        <button
          type="button"
          @click="$emit('close')"
          class="px-4 py-2 font-medium text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors"
        >
          Cancelar
        </button>
        <button
          @click="submit"
          :disabled="isSubmitting"
          class="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
        >
          <Save class="w-4 h-4" />
          <span>{{ isSubmitting ? 'Salvando...' : 'Salvar' }}</span>
        </button>
      </div>
    </div>
  </Modal>
</template>
