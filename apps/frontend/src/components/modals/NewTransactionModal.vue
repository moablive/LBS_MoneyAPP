<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useMediaQuery } from '@vueuse/core';
import { api, fileToBase64 } from '@moneyapp/api-client';
import type { CreateTransactionInput, Receipt, TransactionType, Category, Account } from '@moneyapp/models';
import Modal from './Modal.vue';
import { getLocalYMDHM, formatLocalYMDHM } from '../../utils/date';

import { useAuthStore } from '../../stores/auth';
import type { Transaction } from '@moneyapp/models';

const authStore = useAuthStore();
const open = defineModel<boolean>('open', { default: false });
const props = defineProps<{ transaction?: Transaction | null; defaultType?: TransactionType }>();
const emit = defineEmits<{
  (e: 'created', value: unknown): void;
}>();

const description = ref('');
const absAmount = ref<number | null>(null);
const type = ref<TransactionType>('expense');
const status = ref<'paid' | 'pending'>('paid');
const occurredAt = ref(getLocalYMDHM());
const categoryId = ref<string | ''>('');
const accountId = ref<string | ''>('');
const receiptFile = ref<File | null>(null);
const removeExistingReceipt = ref(false);

const categories = ref<Category[]>([]);
const accounts = ref<Account[]>([]);
const submitting = ref(false);
const error = ref<string | null>(null);

const expenseCategories = computed(() => categories.value.filter((c) => c.type === 'expense'));
const incomeCategories = computed(() => categories.value.filter((c) => c.type === 'income'));

const normalAccounts = computed(() => accounts.value.filter(a => a.type !== 'credit_card'));
const creditCardAccounts = computed(() => accounts.value.filter(a => a.type === 'credit_card'));

// "< sm" no Tailwind = mobile. Reativo (não só CSS) para podermos definir
// padrões de formulário no celular.
const isMobile = useMediaQuery('(max-width: 639px)');

// Categoria "Controle" (despesa) — usada para registro rápido no fim de semana.
// Casa pelo nome (ex.: "Controle 📊"), case-insensitive, para tolerar emoji/variações.
const controleCategory = computed(
  () => categories.value.find((c) => c.type === 'expense' && /controle/i.test(c.name)) ?? null,
);

// Categoria selecionada atualmente é a de Controle? (isenta de comprovante)
const isControleCategory = computed(() => {
  const sel = categories.value.find((c) => c.id === categoryId.value);
  return !!sel && /controle/i.test(sel.name);
});

const statusOptions = computed(() => {
  if (type.value === 'income') {
    return [
      { value: 'paid', label: 'Entrada / Recebido' },
      { value: 'pending', label: 'Pendente / Agendado' }
    ];
  }
  return [
    { value: 'paid', label: 'Pago / Efetivado' },
    { value: 'pending', label: 'Pendente / Agendado' }
  ];
});

// No mobile, despesa nova já inicia em "Controle" para agilizar o lançamento.
// O comprovante fica para depois (no PC), ao trocar para a categoria definitiva.
function maybeDefaultControle() {
  if (props.transaction) return; // só na criação, nunca na edição
  if (!isMobile.value) return; // padrão é exclusivo do mobile
  if (type.value !== 'expense') return; // regra vale só para despesas
  if (categoryId.value) return; // não sobrescreve escolha manual
  if (controleCategory.value) categoryId.value = controleCategory.value.id;
}

watch(
  open,
  async (v) => {
    if (!v) return;
    if (props.transaction) {
      description.value = props.transaction.description;
      absAmount.value = Math.abs(Number(props.transaction.amount));
      type.value = props.transaction.type;
      status.value = props.transaction.status || 'paid';
      occurredAt.value = formatLocalYMDHM(props.transaction.occurredAt);
      categoryId.value = props.transaction.categoryId;
      accountId.value = props.transaction.accountId || '';
      receiptFile.value = null;
      removeExistingReceipt.value = false;
      error.value = null;
    } else {
      reset();
    }
    try {
      [categories.value, accounts.value] = await Promise.all([
        api.get<Category[]>('/categories'),
        api.get<Account[]>('/accounts'),
      ]);
      maybeDefaultControle();
    } catch {
      error.value = 'Não foi possível carregar categorias e contas.';
    }
  },
  { immediate: true }
);

// Categoria é específica por tipo: ao trocar o tipo, descarta seleção inválida
// e, no mobile, re-aplica o padrão "Controle" para despesas.
watch(type, () => {
  if (props.transaction) return;
  if (categoryId.value && !categories.value.some((c) => c.id === categoryId.value)) {
    categoryId.value = '';
  }
  maybeDefaultControle();
});

onMounted(() => reset());

function reset() {
  description.value = '';
  absAmount.value = null;
  type.value = props.defaultType || 'expense';
  status.value = 'paid';
  occurredAt.value = getLocalYMDHM();
  categoryId.value = '';
  accountId.value = '';
  receiptFile.value = null;
  removeExistingReceipt.value = false;
  error.value = null;
}

async function submit() {
  if (!absAmount.value || absAmount.value <= 0 || !categoryId.value) {
    error.value = 'Preencha valor e categoria.';
    return;
  }
  
  const hasUploadedReceipt = !!receiptFile.value;
  const hasExistingReceipt = props.transaction?.hasReceipt && !removeExistingReceipt.value;
  const requireReceipts = authStore.user?.settings?.requireReceipts ?? true;
  
  // Categoria "Controle" é isenta: registra-se rápido no mobile sem comprovante.
  // Ao mudar para outra categoria (ex.: no PC), a exigência normal volta a valer.
  if (requireReceipts && type.value === 'expense' && status.value === 'paid' && !isControleCategory.value && !hasUploadedReceipt && !hasExistingReceipt) {
    error.value = 'É necessário anexar um comprovante para marcar a despesa como paga.';
    return;
  }
  
  submitting.value = true;
  error.value = null;
  try {
    const signed = type.value === 'expense' ? -Math.abs(absAmount.value) : Math.abs(absAmount.value);
    
    let receiptPayload: Receipt | null | undefined = undefined;
    if (receiptFile.value) {
      receiptPayload = (await fileToBase64(receiptFile.value)) as Receipt;
    } else if (removeExistingReceipt.value) {
      receiptPayload = null;
    }

    const payload: CreateTransactionInput = {
      description: description.value.trim(),
      amount: signed,
      type: type.value,
      status: status.value,
      occurredAt: new Date(occurredAt.value).toISOString(),
      categoryId: categoryId.value,
      accountId: accountId.value || null,
      receipt: receiptPayload,
    };
    let saved;
    if (props.transaction) {
      saved = await api.patch<unknown>(`/transactions/${props.transaction.id}`, payload);
    } else {
      saved = await api.post<unknown>('/transactions', payload);
    }
    emit('created', saved);
    window.dispatchEvent(new CustomEvent('transaction-created'));
    open.value = false;
  } catch (e: any) {
    if (e.body?.error === 'receipt_required_for_fatura_payment') {
      error.value = 'Para registrar o pagamento da fatura, é obrigatório anexar o comprovante.';
    } else {
      error.value = 'Não foi possível salvar a transação.';
    }
  } finally {
    submitting.value = false;
  }
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  
  if (file && file.size > 15 * 1024 * 1024) {
    error.value = 'O comprovante excede o tamanho máximo de 15MB.';
    input.value = '';
    receiptFile.value = null;
    return;
  }
  
  error.value = null;
  receiptFile.value = file;
}
</script>

<template>
  <Modal :open="open" :title="transaction ? 'Editar Transação' : 'Nova Transação'" @close="open = false">
    <form class="space-y-4" @submit.prevent="submit">
      <div class="grid grid-cols-2 gap-3">
        <label class="block space-y-1 col-span-2">
          <span class="text-xs uppercase tracking-wide text-muted">Descrição</span>
          <input
            v-model="description"
            required
            maxlength="255"
            placeholder="..."
            class="w-full bg-surface-overlay border border-surface-border rounded-xl px-3 py-2
                   focus:outline-none focus:ring-2 focus:ring-accent/60"
          />
        </label>

        <label class="block space-y-1">
          <span class="text-xs uppercase tracking-wide text-muted">Tipo</span>
          <select
            v-model="type"
            class="w-full bg-surface-overlay border border-surface-border rounded-xl px-3 py-2"
          >
            <option value="expense">Despesa</option>
            <option value="income">Receita</option>
          </select>
        </label>

        <label class="block space-y-1">
          <span class="text-xs uppercase tracking-wide text-muted">Status</span>
          <select
            v-model="status"
            class="w-full bg-surface-overlay border border-surface-border rounded-xl px-3 py-2"
          >
            <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
        </label>

        <label class="block space-y-1">
          <span class="text-xs uppercase tracking-wide text-muted">Valor (R$)</span>
          <input
            v-model.number="absAmount"
            type="number"
            min="0.01"
            step="0.01"
            required
            class="w-full bg-surface-overlay border border-surface-border rounded-xl px-3 py-2 tabular-nums
                   focus:outline-none focus:ring-2 focus:ring-accent/60"
          />
        </label>

        <label class="block space-y-1">
          <span class="text-xs uppercase tracking-wide text-muted">Data e Hora</span>
          <input
            v-model="occurredAt"
            type="datetime-local"
            required
            class="w-full bg-surface-overlay border border-surface-border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/60 [color-scheme:dark]"
          />
        </label>

        <label class="block space-y-1">
          <span class="text-xs uppercase tracking-wide text-muted">Categoria</span>
          <select
            v-model="categoryId"
            required
            class="w-full bg-surface-overlay border border-surface-border rounded-xl px-3 py-2"
          >
            <option value="" disabled>Selecione…</option>
            <optgroup label="Despesas" v-if="expenseCategories.length > 0">
              <option v-for="c in expenseCategories" :key="c.id" :value="c.id">{{ c.name }}</option>
            </optgroup>
            <optgroup label="Receitas" v-if="incomeCategories.length > 0">
              <option v-for="c in incomeCategories" :key="c.id" :value="c.id">{{ c.name }}</option>
            </optgroup>
          </select>
        </label>

        <label class="block space-y-1 col-span-2">
          <span class="text-xs uppercase tracking-wide text-muted">Conta (opcional)</span>
          <select
            v-model="accountId"
            class="w-full bg-surface-overlay border border-surface-border rounded-xl px-3 py-2"
          >
            <option value="">— sem conta —</option>
            <optgroup label="Contas" v-if="normalAccounts.length > 0">
              <option v-for="a in normalAccounts" :key="a.id" :value="a.id">{{ a.name }}</option>
            </optgroup>
            <optgroup label="Cartões de Crédito" v-if="creditCardAccounts.length > 0">
              <option v-for="a in creditCardAccounts" :key="a.id" :value="a.id">{{ a.name }}</option>
            </optgroup>
          </select>
        </label>
      </div>

      <label class="block space-y-1">
        <span class="text-xs uppercase tracking-wide text-muted">Comprovante (PNG/JPG/PDF, máx 15MB)</span>
        
        <div v-if="transaction?.hasReceipt && !removeExistingReceipt && !receiptFile" class="flex items-center gap-3 p-3 bg-surface-base border border-surface-border rounded-xl">
          <span class="text-sm text-white font-medium flex-1">Comprovante anexado</span>
          <button type="button" @click="removeExistingReceipt = true" class="text-xs text-expense hover:underline">
            Remover / Trocar
          </button>
        </div>

        <input
          v-else
          type="file"
          accept="image/png,image/jpeg,image/webp,application/pdf"
          class="w-full text-sm text-muted file:mr-3 file:px-3 file:py-2 file:rounded-xl
                 file:border-0 file:bg-surface-overlay file:text-slate-100"
          @change="onFileChange"
        />
        
        <p v-if="removeExistingReceipt && !receiptFile" class="text-xs text-muted mt-1">O comprovante atual será removido ao salvar.</p>
        <p v-if="isControleCategory && type === 'expense'" class="text-xs text-muted mt-1">Categoria Controle: comprovante opcional. Ao trocar para a categoria definitiva, o comprovante passa a ser exigido.</p>
      </label>

      <p v-if="error" class="text-sm text-expense">{{ error }}</p>

      <div class="flex justify-end gap-2 pt-2">
        <button
          type="button"
          class="px-4 py-2 rounded-xl border border-surface-border text-muted hover:text-slate-100"
          @click="open = false"
        >
          Cancelar
        </button>
        <button
          type="submit"
          :disabled="submitting"
          class="px-4 py-2 rounded-xl bg-accent text-white font-medium disabled:opacity-60"
        >
          {{ submitting ? 'Salvando…' : 'Salvar' }}
        </button>
      </div>
    </form>
  </Modal>
</template>
