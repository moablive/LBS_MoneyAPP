<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { api, fileToBase64 } from '@moneyapp/api-client';
import type { Account, Category, Receipt } from '@moneyapp/models';
import { useAuthStore } from '../../stores/auth';
import Modal from './Modal.vue';
import { getLocalYMD } from '../../utils/date';

const authStore = useAuthStore();

const open = defineModel<boolean>('open', { default: false });
const props = defineProps<{ item: any | null }>();
const emit = defineEmits<{ (e: 'paid'): void }>();

const amount = ref<number | null>(null);
const date = ref(getLocalYMD());
const accountId = ref<string | ''>('');

const accounts = ref<Account[]>([]);
const submitting = ref(false);
const error = ref<string | null>(null);
const receiptFile = ref<File | null>(null);

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

const eligibleAccounts = computed(() => {
  if (props.item?.isCreditCard) {
    // If paying a credit card invoice, source account can't be the same credit card
    return accounts.value.filter(a => a.id !== props.item.account?.id && a.type !== 'credit_card');
  }
  return accounts.value;
});

const bankAccounts = computed(() => eligibleAccounts.value.filter(a => a.type !== 'credit_card'));
const creditCards = computed(() => eligibleAccounts.value.filter(a => a.type === 'credit_card'));

watch(open, async (v) => {
  if (!v) return;
  
  if (props.item) {
    amount.value = Math.abs(Number(props.item.amount)) || null;
  } else {
    amount.value = null;
  }
  date.value = getLocalYMD();
  accountId.value = '';
  error.value = null;
  receiptFile.value = null;

  try {
    const accs = await api.get<Account[]>('/accounts');
    accounts.value = accs;
    
    if (props.item && !props.item.isCreditCard && !props.item.isSubscription && !props.item.isLoan) {
      if (props.item.accountId) {
        accountId.value = props.item.accountId;
      }
    }
  } catch {
    error.value = 'Não foi possível carregar contas.';
  }
}, { immediate: true });

async function submit() {
  if (!amount.value || amount.value <= 0 || !accountId.value || !props.item) {
    error.value = 'Preencha valor e conta.';
    return;
  }
  
  const requireReceipts = authStore.user?.settings?.requireReceipts ?? true;
  const isControleCategory = props.item?.categoryId && 
    (props.item?.originalItem?.category?.name?.toUpperCase().includes('CONTROLE') || false);

  if (requireReceipts && !receiptFile.value && !isControleCategory) {
    error.value = 'É obrigatório anexar um comprovante antes de confirmar o pagamento.';
    return;
  }
  
  submitting.value = true;
  error.value = null;
  
  try {
    let receiptPayload: Receipt | null | undefined = undefined;
    if (receiptFile.value) {
      receiptPayload = (await fileToBase64(receiptFile.value)) as Receipt;
    }

    if (props.item.isCreditCard) {
      // Logic for credit card invoice
      const payload: any = {
        amount: amount.value,
        sourceAccountId: accountId.value || null,
        categoryId: props.item.categoryId,
        date: new Date(`${date.value}T12:00:00Z`).toISOString(),
        description: 'Pagamento de Fatura',
        receipt: receiptPayload,
      };
      
      const cats = await api.get<Category[]>('/categories');
      const faturaCat = cats.find(c => c.type === 'expense' && c.name.toUpperCase().includes('FATURA'));
      if (faturaCat) payload.categoryId = faturaCat.id;
      
      await api.post(`/accounts/${props.item.account.id}/pay-invoice`, payload);
    } else if (props.item.isSubscription || props.item.isLoan) {
      const cats = await api.get<Category[]>('/categories');
      let finalCategoryId = props.item.categoryId || props.item.originalItem?.categoryId || null;
      
      if (!finalCategoryId && props.item.isSubscription) {
        const assinaturasCat = cats.find(c => c.name.toUpperCase().includes('ASSINATURA'));
        if (assinaturasCat) {
          finalCategoryId = assinaturasCat.id;
        }
      }

      if (!finalCategoryId && cats.length > 0) {
        const matchingCat = cats.find(c => c.type === props.item.type) || cats[0];
        finalCategoryId = matchingCat?.id || null;
      }

      if (!finalCategoryId) {
        error.value = 'É necessário selecionar uma categoria para este lançamento.';
        return;
      }

      // Create a new transaction
      const payload: any = {
        description: props.item.description,
        amount: props.item.type === 'expense' ? -Math.abs(amount.value) : Math.abs(amount.value),
        type: props.item.type,
        status: 'paid',
        occurredAt: new Date(`${date.value}T12:00:00Z`).toISOString(),
        categoryId: finalCategoryId,
        accountId: accountId.value || undefined,
        receipt: receiptPayload || undefined,
        ...(props.item.isSubscription ? { subscriptionId: props.item.originalItem?.id || props.item.id?.replace(/^sub-/, '').replace(/-\d{4}-\d{2}.*$/, '') } : {})
      };
      await api.post('/transactions', payload);
    } else {
      // Patch existing pending transaction
      const payload: any = {
        amount: props.item.type === 'expense' ? -Math.abs(amount.value) : Math.abs(amount.value),
        accountId: accountId.value || undefined,
        occurredAt: new Date(`${date.value}T12:00:00Z`).toISOString(),
        status: 'paid',
        ...(receiptPayload ? { receipt: receiptPayload } : {})
      };
      await api.patch(`/transactions/${props.item.id}`, payload);
    }
    
    emit('paid');
    window.dispatchEvent(new CustomEvent('transaction-created'));
    open.value = false;
  } catch (e: any) {
    console.error('Failed to confirm payment:', e);
    const serverError = e.response?.data?.error || e.response?.data?.message || e.message;
    if (serverError === 'receipt_required_for_fatura_payment') {
      error.value = 'É obrigatório anexar comprovante para pagamento de fatura.';
    } else if (typeof serverError === 'string' && serverError.length < 100) {
      error.value = `Erro: ${serverError}`;
    } else {
      error.value = 'Não foi possível confirmar o pagamento.';
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <Modal :open="open" :title="`Confirmar Pagamento - ${item?.description || ''}`" @close="open = false">
    <form class="space-y-4" @submit.prevent="submit">
      <div class="space-y-3">
        <label class="block space-y-1">
          <span class="text-xs uppercase tracking-wide text-muted">Valor (R$)</span>
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
          <span class="text-xs uppercase tracking-wide text-muted">Data</span>
          <input
            v-model="date"
            type="date"
            required
            class="w-full bg-surface-overlay border border-surface-border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/60 [color-scheme:dark]"
          />
        </label>

        <label class="block space-y-1">
          <span class="text-xs uppercase tracking-wide text-muted">Conta Usada</span>
          <select
            v-model="accountId"
            required
            class="w-full bg-surface-overlay border border-surface-border rounded-xl px-3 py-2"
          >
            <option value="" disabled>— sem conta —</option>
            <optgroup label="Contas" v-if="bankAccounts.length > 0">
              <option v-for="a in bankAccounts" :key="a.id" :value="a.id">{{ a.name }}</option>
            </optgroup>
            <optgroup label="Cartões de Crédito" v-if="creditCards.length > 0">
              <option v-for="a in creditCards" :key="a.id" :value="a.id">{{ a.name }}</option>
            </optgroup>
          </select>
        </label>
        
        <label class="block space-y-1">
          <span class="text-xs uppercase tracking-wide text-muted">Comprovante (PNG/JPG/PDF, máx 15MB)</span>
          <div class="relative group">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              @change="onFileChange"
            />
            <div class="w-full bg-surface-overlay border border-surface-border rounded-xl px-3 py-3 flex items-center justify-center gap-2 group-hover:border-accent/50 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted group-hover:text-accent transition-colors"><path d="M21.2 15c.7-1.2 1-2.5.7-3.9-.6-2-2.4-3.5-4.4-3.5h-1.2c-.7-3-3.2-5.2-6.2-5.6-3-.3-5.9 1.3-7.3 4-1.2 2.5-1 6.5.5 8.8m8.7-1.6V21"/><path d="M16 16l-4-4-4 4"/></svg>
              <span class="text-sm font-medium" :class="receiptFile ? 'text-accent' : 'text-muted group-hover:text-slate-300'">
                {{ receiptFile ? receiptFile.name : 'Clique para escolher ou tire uma foto' }}
              </span>
            </div>
          </div>
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
          {{ submitting ? 'Processando…' : 'Confirmar' }}
        </button>
      </div>
    </form>
  </Modal>
</template>
