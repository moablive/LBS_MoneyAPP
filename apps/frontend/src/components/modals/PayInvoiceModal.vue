<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { api, fileToBase64 } from '@moneyapp/api-client';
import type { Account, Category, Receipt, PayInvoiceInput } from '@moneyapp/models';
import { useAuthStore } from '../../stores/auth';
import Modal from './Modal.vue';

const authStore = useAuthStore();
const open = defineModel<boolean>('open', { default: false });
const props = defineProps<{ creditCard: Account | null }>();
const emit = defineEmits<{ (e: 'paid'): void }>();

const amount = ref<number | null>(null);
const date = ref(new Date(Date.now() - 10800000).toISOString().slice(0, 10));
const sourceAccountId = ref<string | ''>('');
const categoryId = ref<string | ''>('');
const description = ref('Pagamento de Fatura');

const accounts = ref<Account[]>([]);
const categories = ref<Category[]>([]);
const submitting = ref(false);
const error = ref<string | null>(null);
const receiptFile = ref<File | null>(null);

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  if (file && file.size > 5 * 1024 * 1024) {
    error.value = 'O comprovante excede o tamanho máximo de 5MB.';
    input.value = '';
    receiptFile.value = null;
    return;
  }
  error.value = null;
  receiptFile.value = file;
}

const sourceAccounts = computed(() => accounts.value.filter(a => a.id !== props.creditCard?.id));
const normalAccounts = computed(() => sourceAccounts.value.filter(a => a.type !== 'credit_card'));
const creditCardAccounts = computed(() => sourceAccounts.value.filter(a => a.type === 'credit_card'));

// filter categories to only show expense ones (since paying fatura is generally categorized as an expense from the checking account perspective)
const visibleCategories = computed(() => categories.value.filter(c => c.type === 'expense'));

watch(open, async (v) => {
  if (!v) return;
  
  if (props.creditCard) {
    amount.value = Math.abs(Number(props.creditCard.currentBalance)) || null;
  } else {
    amount.value = null;
  }
  date.value = new Date(Date.now() - 10800000).toISOString().slice(0, 10);
  sourceAccountId.value = '';
  categoryId.value = '';
  description.value = 'Pagamento de Fatura';
  receiptFile.value = null;
  error.value = null;

  try {
    const [cats, accs] = await Promise.all([
      api.get<Category[]>('/categories'),
      api.get<Account[]>('/accounts'),
    ]);
    categories.value = cats;
    accounts.value = accs;
    
    // Auto-select a category with "FATURA" in the name if possible
    const faturaCat = cats.find(c => c.type === 'expense' && c.name.toUpperCase().includes('FATURA'));
    if (faturaCat) categoryId.value = faturaCat.id;
  } catch {
    error.value = 'Não foi possível carregar categorias e contas.';
  }
}, { immediate: true });

async function submit() {
  if (!amount.value || amount.value <= 0 || !categoryId.value || !props.creditCard) {
    error.value = 'Preencha valor e categoria.';
    return;
  }
  
  const requireReceipts = authStore.user?.settings?.requireReceipts ?? true;
  if (requireReceipts && !receiptFile.value) {
    error.value = 'Para registrar o pagamento da fatura, é obrigatório anexar o comprovante.';
    return;
  }
  
  submitting.value = true;
  error.value = null;
  
  try {
    let receiptPayload: Receipt | null | undefined = undefined;
    if (receiptFile.value) {
      receiptPayload = (await fileToBase64(receiptFile.value)) as Receipt;
    }

    const payload: PayInvoiceInput = {
      amount: amount.value,
      sourceAccountId: sourceAccountId.value || null,
      categoryId: categoryId.value,
      date: new Date(`${date.value}T12:00:00Z`).toISOString(),
      description: description.value.trim() || 'Pagamento de Fatura',
      receipt: receiptPayload,
    };
    
    await api.post(`/accounts/${props.creditCard.id}/pay-invoice`, payload);
    
    emit('paid');
    window.dispatchEvent(new CustomEvent('transaction-created'));
    open.value = false;
  } catch (e: any) {
    console.error(e);
    error.value = e.body?.error || e.body?.message || 'Não foi possível registrar o pagamento.';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <Modal :open="open" :title="`Pagar Fatura - ${creditCard?.name || ''}`" @close="open = false">
    <form class="space-y-4" @submit.prevent="submit">
      <div class="space-y-3">
        <label class="block space-y-1">
          <span class="text-xs uppercase tracking-wide text-muted">Valor Pago (R$)</span>
          <input
            v-model.number="amount"
            type="number"
            min="0.01"
            step="0.01"
            required
            class="w-full bg-surface-overlay border border-surface-border rounded-xl px-3 py-2 tabular-nums focus:outline-none focus:ring-2 focus:ring-accent/60"
          />
        </label>

        <label class="block space-y-1">
          <span class="text-xs uppercase tracking-wide text-muted">Data do Pagamento</span>
          <input
            v-model="date"
            type="date"
            required
            class="w-full bg-surface-overlay border border-surface-border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/60 [color-scheme:dark]"
          />
        </label>

        <label class="block space-y-1">
          <span class="text-xs uppercase tracking-wide text-muted">Conta de Origem</span>
          <select
            v-model="sourceAccountId"
            class="w-full bg-surface-overlay border border-surface-border rounded-xl px-3 py-2"
          >
            <option value="">— Sem conta (Apenas zerar dívida) —</option>
            <optgroup label="Contas" v-if="normalAccounts.length > 0">
              <option v-for="a in normalAccounts" :key="a.id" :value="a.id">{{ a.name }}</option>
            </optgroup>
            <optgroup label="Cartões de Crédito" v-if="creditCardAccounts.length > 0">
              <option v-for="a in creditCardAccounts" :key="a.id" :value="a.id">{{ a.name }}</option>
            </optgroup>
          </select>
          <p class="text-[10px] text-muted mt-1">O valor será debitado desta conta.</p>
        </label>

        <label class="block space-y-1">
          <span class="text-xs uppercase tracking-wide text-muted">Categoria</span>
          <select
            v-model="categoryId"
            required
            class="w-full bg-surface-overlay border border-surface-border rounded-xl px-3 py-2"
          >
            <option value="" disabled>Selecione…</option>
            <option v-for="c in visibleCategories" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </label>

        <label class="block space-y-1">
          <span class="text-xs uppercase tracking-wide text-muted">Comprovante (PNG/JPG/PDF, máx 5MB)</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            class="w-full text-sm text-muted file:mr-3 file:px-3 file:py-2 file:rounded-xl file:border-0 file:bg-surface-overlay file:text-slate-100"
            @change="onFileChange"
          />
        </label>
      </div>

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
          {{ submitting ? 'Processando…' : 'Pagar' }}
        </button>
      </div>
    </form>
  </Modal>
</template>
