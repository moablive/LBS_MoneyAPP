<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { api } from '@moneyapp/api-client';
import type { Account, Category } from '@moneyapp/models';
import Modal from './Modal.vue';

const open = defineModel<boolean>('open', { default: false });
const props = defineProps<{ item: any | null }>();
const emit = defineEmits<{ (e: 'paid'): void }>();

const amount = ref<number | null>(null);
const date = ref(new Date().toISOString().slice(0, 10));
const accountId = ref<string | ''>('');

const accounts = ref<Account[]>([]);
const submitting = ref(false);
const error = ref<string | null>(null);

const eligibleAccounts = computed(() => {
  if (props.item?.isCreditCard) {
    // If paying a credit card invoice, source account can't be the same credit card
    return accounts.value.filter(a => a.id !== props.item.account?.id && a.type !== 'credit_card');
  }
  return accounts.value;
});

watch(open, async (v) => {
  if (!v) return;
  
  if (props.item) {
    amount.value = Math.abs(Number(props.item.amount)) || null;
  } else {
    amount.value = null;
  }
  date.value = new Date().toISOString().slice(0, 10);
  accountId.value = '';
  error.value = null;

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
  
  submitting.value = true;
  error.value = null;
  
  try {
    if (props.item.isCreditCard) {
      // Logic for credit card invoice
      const payload = {
        amount: amount.value,
        sourceAccountId: accountId.value || null,
        categoryId: props.item.categoryId, // Will probably need to fetch "Fatura" category if not provided
        date: new Date(`${date.value}T12:00:00Z`).toISOString(),
        description: 'Pagamento de Fatura',
      };
      // We need a category for invoice payment. Let's fetch categories.
      const cats = await api.get<Category[]>('/categories');
      const faturaCat = cats.find(c => c.type === 'expense' && c.name.toUpperCase().includes('FATURA'));
      if (faturaCat) payload.categoryId = faturaCat.id;
      
      await api.post(`/accounts/${props.item.account.id}/pay-invoice`, payload);
    } else if (props.item.isSubscription || props.item.isLoan) {
      // Create a new transaction
      const payload = {
        amount: amount.value,
        accountId: accountId.value,
        categoryId: props.item.categoryId || null,
        date: new Date(`${date.value}T12:00:00Z`).toISOString(),
        occurredAt: new Date(`${date.value}T12:00:00Z`).toISOString(),
        description: props.item.description,
        type: props.item.type,
        status: 'paid'
      };
      await api.post('/transactions', payload);
    } else {
      // Patch existing pending transaction
      const payload = {
        amount: amount.value,
        accountId: accountId.value,
        occurredAt: new Date(`${date.value}T12:00:00Z`).toISOString(),
        status: 'paid'
      };
      await api.patch(`/transactions/${props.item.id}`, payload);
    }
    
    emit('paid');
    window.dispatchEvent(new CustomEvent('transaction-created'));
    open.value = false;
  } catch (e: any) {
    error.value = 'Não foi possível confirmar o pagamento.';
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
            <option value="" disabled>Selecione a conta...</option>
            <option v-for="a in eligibleAccounts" :key="a.id" :value="a.id">{{ a.name }}</option>
          </select>
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
