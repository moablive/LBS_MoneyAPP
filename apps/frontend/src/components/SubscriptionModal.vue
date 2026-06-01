<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue';
import { api } from '@moneyapp/shared';
import { useConfirmDialog } from '../composables/useConfirmDialog';
import type { CreateSubscriptionInput, SubscriptionItem, UpdateSubscriptionInput, Account } from '@moneyapp/shared';

const { confirm } = useConfirmDialog();

const props = defineProps<{
  show: boolean;
  subscriptionToEdit?: SubscriptionItem | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'saved'): void;
  (e: 'deleted'): void;
}>();

const description = ref('');
const amount = ref('');
const type = ref<'expense' | 'income'>('expense');
const categoryId = ref('');
const accountId = ref('');
const status = ref<'active' | 'inactive'>('active');
const billingDay = ref('');

const categories = ref<any[]>([]);
const accounts = ref<Account[]>([]);
const isSaving = ref(false);
const errorMsg = ref('');

const filteredCategories = computed(() => {
  return categories.value.filter((c) => c.type === type.value);
});

onMounted(async () => {
  const [catRes, accRes] = await Promise.all([
    api.get<any[]>('/categories'),
    api.get<Account[]>('/accounts'),
  ]);
  categories.value = catRes;
  accounts.value = accRes;
});

watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      if (props.subscriptionToEdit) {
        const s = props.subscriptionToEdit;
        description.value = s.description;
        amount.value = s.amount.toString();
        type.value = s.type;
        categoryId.value = s.categoryId;
        accountId.value = s.accountId ?? '';
        status.value = s.status;
        billingDay.value = s.billingDay ? s.billingDay.toString() : '';
      } else {
        description.value = '';
        amount.value = '';
        type.value = 'expense';
        categoryId.value = '';
        accountId.value = '';
        status.value = 'active';
        billingDay.value = '';
        errorMsg.value = '';
      }
    }
  }
);

watch(type, (newType) => {
  if (categoryId.value) {
    const cat = categories.value.find((c) => c.id === categoryId.value);
    if (cat && cat.type !== newType) {
      categoryId.value = '';
    }
  }
});

async function save() {
  if (!description.value || !amount.value || !categoryId.value || !billingDay.value) {
    errorMsg.value = 'Por favor, preencha todos os campos obrigatórios.';
    return;
  }
  
  errorMsg.value = '';
  isSaving.value = true;
  try {
    const payload: CreateSubscriptionInput | UpdateSubscriptionInput = {
      description: description.value,
      amount: Number(amount.value.toString().replace(',', '.')),
      type: type.value,
      categoryId: categoryId.value,
      accountId: accountId.value || undefined,
      status: status.value,
      billingDay: billingDay.value ? parseInt(billingDay.value, 10) : undefined,
    };

    if (props.subscriptionToEdit) {
      await api.put(`/subscriptions/${props.subscriptionToEdit.id}`, payload);
    } else {
      await api.post('/subscriptions', payload);
    }
    emit('saved');
    emit('close');
  } catch (e) {
    console.error(e);
  } finally {
    isSaving.value = false;
  }
}

async function remove() {
  if (!props.subscriptionToEdit) return;
  if (!(await confirm('Tem certeza que deseja excluir esta assinatura?'))) return;

  isSaving.value = true;
  try {
    await api.delete(`/subscriptions/${props.subscriptionToEdit.id}`);
    emit('deleted');
    emit('close');
  } catch (e) {
    console.error(e);
  } finally {
    isSaving.value = false;
  }
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
    <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="emit('close')"></div>
    <div class="relative bg-surface-raised border border-surface-border w-full max-w-md rounded-2xl shadow-xl overflow-hidden flex flex-col">
      <header class="px-5 py-4 border-b border-surface-border flex justify-between items-center bg-surface-overlay/30">
        <h2 class="text-lg font-medium">
          {{ subscriptionToEdit ? 'Editar Assinatura' : 'Nova Assinatura' }}
        </h2>
        <button @click="emit('close')" class="text-muted hover:text-slate-100 p-1">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </header>

      <div class="p-5 overflow-y-auto space-y-4">
        <!-- Type Toggle removed -> Subscriptions are always expenses -->

        <div>
          <label class="block text-xs uppercase tracking-wider text-muted mb-1.5">Descrição</label>
          <input
            v-model="description"
            type="text"
            placeholder="Ex: Netflix, Spotify..."
            class="w-full bg-surface-overlay border border-surface-border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/60"
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs uppercase tracking-wider text-muted mb-1.5">Valor Mensal</label>
            <div class="relative">
              <span class="absolute left-3 top-2 text-muted">R$</span>
              <input
                v-model="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                class="w-full pl-9 pr-3 py-2 bg-surface-overlay border border-surface-border rounded-xl focus:outline-none focus:ring-2 focus:ring-accent/60"
              />
            </div>
          </div>
          <div>
            <label class="block text-xs uppercase tracking-wider text-muted mb-1.5">Dia Vencimento</label>
            <input
              v-model="billingDay"
              type="number"
              min="1"
              max="31"
              placeholder="Ex: 5"
              class="w-full bg-surface-overlay border border-surface-border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/60"
            />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs uppercase tracking-wider text-muted mb-1.5">Categoria</label>
            <select
              v-model="categoryId"
              class="w-full bg-surface-overlay border border-surface-border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/60"
            >
              <option value="" disabled>Selecione</option>
              <option v-for="c in filteredCategories" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>
          <div>
            <label class="block text-xs uppercase tracking-wider text-muted mb-1.5">Conta</label>
            <select
              v-model="accountId"
              class="w-full bg-surface-overlay border border-surface-border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/60"
            >
              <option value="">Outro</option>
              <option v-for="a in accounts" :key="a.id" :value="a.id">{{ a.name }}</option>
            </select>
          </div>
        </div>

        <div>
          <label class="block text-xs uppercase tracking-wider text-muted mb-1.5">Status</label>
          <div class="flex items-center gap-3">
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="radio" v-model="status" value="active" class="text-accent focus:ring-accent" />
              <span class="text-sm">Ativa</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input type="radio" v-model="status" value="inactive" class="text-accent focus:ring-accent" />
              <span class="text-sm">Inativa</span>
            </label>
          </div>
        </div>
      </div>

      <div v-if="errorMsg" class="px-5 py-2 text-sm text-expense bg-expense/10 border-t border-expense/20">
        {{ errorMsg }}
      </div>

      <footer class="p-5 border-t border-surface-border flex justify-between gap-3 bg-surface-overlay/30">
        <div>
          <button
            v-if="subscriptionToEdit"
            type="button"
            class="px-4 py-2 rounded-xl text-expense hover:bg-expense/10 text-sm font-medium transition-colors"
            @click="remove"
          >
            Excluir
          </button>
        </div>
        <div class="flex gap-3">
          <button
            type="button"
            class="px-4 py-2 rounded-xl bg-surface-overlay hover:bg-surface-border text-sm font-medium transition-colors"
            @click="emit('close')"
          >
            Cancelar
          </button>
          <button
            type="button"
            class="px-5 py-2 rounded-xl bg-accent text-white text-sm font-medium disabled:opacity-50 transition-colors"
            :disabled="!description || !amount || !categoryId || isSaving"
            @click="save"
          >
            {{ isSaving ? 'Salvando...' : 'Salvar' }}
          </button>
        </div>
      </footer>
    </div>
  </div>
</template>
