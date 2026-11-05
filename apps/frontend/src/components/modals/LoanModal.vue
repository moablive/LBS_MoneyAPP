<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { api, fileToBase64 } from '@moneyapp/api-client';
import type { LoanItem, Account, Category } from '@moneyapp/models';
import { useAuthStore } from '../../stores/auth';
import { useConfirmDialog } from '../../composables/useConfirmDialog';
import { onKeyStroke } from '@vueuse/core';
import { getLocalYMD } from '../../utils/date';

onKeyStroke('Escape', (e) => {
  if (show.value) {
    e.preventDefault();
    show.value = false;
  }
});

const { confirm, alert } = useConfirmDialog();

const show = defineModel<boolean>('show', { default: false });
const props = defineProps<{
  loanToEdit: LoanItem | null;
}>();

const emit = defineEmits<{
  (e: 'saved', status?: string): void;
  (e: 'deleted'): void;
}>();

const loading = ref(false);

const form = ref({
  description: '',
  amount: '',
  expectedAmount: '',
  accountId: null as string | null,
  installments: 1,
  date: getLocalYMD() as string,
  // null = ainda não escolheu: o modal pergunta primeiro se vai emprestar (verde) ou pedir emprestado (vermelho)
  type: null as 'given' | 'received' | 'fgts' | null,
  status: 'active' as 'active' | 'paid',
  categoryId: null as string | null,
});

const TIPOS = {
  given: { rotulo: 'Vou emprestar', sub: 'Alguém fica me devendo', cor: 'income' },
  received: { rotulo: 'Vou pedir emprestado', sub: 'Eu fico devendo', cor: 'expense' },
  fgts: { rotulo: 'FGTS / governamental', sub: 'Saque ou antecipação', cor: 'blue' },
} as const;
const tipo = computed(() => (form.value.type ? TIPOS[form.value.type] : null));
const corBorda = computed(() =>
  form.value.type === 'given' ? 'border-t-4 border-t-income'
  : form.value.type === 'received' ? 'border-t-4 border-t-expense'
  : form.value.type === 'fgts' ? 'border-t-4 border-t-blue-400' : '');
const corSalvar = computed(() =>
  form.value.type === 'given' ? 'bg-income hover:bg-income/90'
  : form.value.type === 'received' ? 'bg-expense hover:bg-expense/90'
  : 'bg-accent hover:bg-accent/90');

const accounts = ref<Account[]>([]);
const categories = ref<Category[]>([]);

const normalAccounts = computed(() => accounts.value.filter(a => a.type !== 'credit_card'));
const creditCardAccounts = computed(() => accounts.value.filter(a => a.type === 'credit_card'));

const receiptFile = ref<File | null>(null);
const receiptBlobUrl = ref<string | null>(null);
const loadingReceipt = ref(false);
const isPdf = ref(false);

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  receiptFile.value = input.files?.[0] ?? null;
  if (receiptBlobUrl.value) {
    URL.revokeObjectURL(receiptBlobUrl.value);
    receiptBlobUrl.value = null;
  }
}

const paymentReceiptFile = ref<File | null>(null);
const paymentReceiptBlobUrl = ref<string | null>(null);
const loadingPaymentReceipt = ref(false);
const isPaymentPdf = ref(false);

function onPaymentFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  paymentReceiptFile.value = input.files?.[0] ?? null;
  if (paymentReceiptFile.value) {
    form.value.status = 'paid';
  }
  if (paymentReceiptBlobUrl.value) {
    URL.revokeObjectURL(paymentReceiptBlobUrl.value);
    paymentReceiptBlobUrl.value = null;
  }
}

function resetForm() {
  if (props.loanToEdit) {
    let uiAmount = String(props.loanToEdit.amount);
    let uiExpected = '';
    
    const dbAmount = Number(props.loanToEdit.amount);
    const rawExpected = (props.loanToEdit as any).expectedAmount;
    const dbExpected = rawExpected !== undefined && rawExpected !== null ? Number(rawExpected) : null;

    if (props.loanToEdit.type === 'received') {
      if (dbExpected !== null && dbExpected !== dbAmount) {
        uiAmount = String(dbExpected);
        uiExpected = String(dbAmount);
      } else {
        uiAmount = String(dbAmount);
        uiExpected = '';
      }
    } else {
      if (dbExpected !== null && dbExpected !== dbAmount) {
        uiExpected = String(dbExpected);
      } else {
        uiExpected = '';
      }
    }

    form.value = {
      description: props.loanToEdit.description,
      amount: uiAmount,
      expectedAmount: uiExpected,
      accountId: props.loanToEdit.accountId || null,
      installments: 1,
      date: props.loanToEdit.date.split('T')[0] as string,
      type: props.loanToEdit.type,
      status: props.loanToEdit.status,
      categoryId: (props.loanToEdit as any).categoryId || null,
    };
  } else {
    form.value = {
      description: '',
      amount: '',
      expectedAmount: '',
      accountId: null,
      installments: 1,
      date: getLocalYMD() as string,
      type: null, // sempre começa pela pergunta "O que você vai fazer?"
      status: 'active',
      categoryId: null,
    };
  }
}

watch(show, async (val) => {
  if (val) {
    if (accounts.value.length === 0 || categories.value.length === 0) {
      try {
        const [accs, cats] = await Promise.all([
          api.get<Account[]>('/accounts'),
          api.get<Category[]>('/categories')
        ]);
        accounts.value = accs;
        categories.value = cats;
      } catch (e) {
        console.error('Failed to load accounts or categories', e);
      }
    }
    if (receiptBlobUrl.value) {
      URL.revokeObjectURL(receiptBlobUrl.value);
    }
    if (paymentReceiptBlobUrl.value) {
      URL.revokeObjectURL(paymentReceiptBlobUrl.value);
    }
    resetForm();
    receiptFile.value = null;
    receiptBlobUrl.value = null;
    isPdf.value = false;
    paymentReceiptFile.value = null;
    paymentReceiptBlobUrl.value = null;
    isPaymentPdf.value = false;

    if (props.loanToEdit?.hasReceipt) {
      loadingReceipt.value = true;
      try {
        const BASE = import.meta.env.VITE_API_BASE_URL as string;
        const auth = useAuthStore();
        const headers: Record<string, string> = {};
        if (auth.token) headers.Authorization = `Bearer ${auth.token}`;
        
        const res = await fetch(`${BASE}/loans/${props.loanToEdit.id}/receipt`, { headers });
        if (res.ok) {
          const blob = await res.blob();
          isPdf.value = blob.type === 'application/pdf';
          receiptBlobUrl.value = URL.createObjectURL(blob);
        }
      } catch (e) {
        console.error('Failed to load receipt:', e);
      } finally {
        loadingReceipt.value = false;
      }
    }

    if (props.loanToEdit?.hasPaymentReceipt) {
      loadingPaymentReceipt.value = true;
      try {
        const BASE = import.meta.env.VITE_API_BASE_URL as string;
        const auth = useAuthStore();
        const headers: Record<string, string> = {};
        if (auth.token) headers.Authorization = `Bearer ${auth.token}`;
        
        const res = await fetch(`${BASE}/loans/${props.loanToEdit.id}/payment-receipt`, { headers });
        if (res.ok) {
          const blob = await res.blob();
          isPaymentPdf.value = blob.type === 'application/pdf';
          paymentReceiptBlobUrl.value = URL.createObjectURL(blob);
        }
      } catch (e) {
        console.error('Failed to load payment receipt:', e);
      } finally {
        loadingPaymentReceipt.value = false;
      }
    }
  }
}, { immediate: true });

async function save() {
  if (!form.value.type) return;
  if (form.value.status === 'paid') {
    const hasExistingPaymentReceipt = !!props.loanToEdit?.hasPaymentReceipt;
    if (!paymentReceiptFile.value && !hasExistingPaymentReceipt) {
      await alert('É necessário anexar um comprovante de pagamento para marcar como pago.');
      return;
    }
  }

  let apiAmount = Number(String(form.value.amount).replace(',', '.'));
  let apiExpected: number | null | undefined = form.value.expectedAmount ? Number(String(form.value.expectedAmount).replace(',', '.')) : undefined;

  if (apiExpected !== undefined && apiExpected === apiAmount) {
    apiExpected = undefined;
  }

  if (form.value.type === 'received') {
    if (apiExpected !== null && apiExpected !== undefined) {
      const temp = apiAmount;
      apiAmount = apiExpected;
      apiExpected = temp;
    } else {
      apiAmount = Number(String(form.value.amount).replace(',', '.'));
      apiExpected = undefined;
    }
  }

  const payload = {
    description: form.value.description,
    amount: apiAmount,
    expectedAmount: apiExpected,
    accountId: form.value.accountId || undefined,
    date: new Date(form.value.date as string).toISOString(),
    type: form.value.type,
    status: form.value.status,
    categoryId: form.value.categoryId || undefined,
    installments: form.value.installments,
    receipt: receiptFile.value
      ? ((await fileToBase64(receiptFile.value)) as { mimeType: string, base64: string })
      : undefined,
    paymentReceipt: paymentReceiptFile.value
      ? ((await fileToBase64(paymentReceiptFile.value)) as { mimeType: string, base64: string })
      : undefined,
  };

  try {
    loading.value = true;
    if (props.loanToEdit) {
      await api.put(`/loans/${props.loanToEdit.id}`, payload);
    } else {
      await api.post('/loans', payload);
    }
    emit('saved', form.value.status);
    show.value = false;
  } catch (error) {
    await alert('Erro ao salvar empréstimo.');
    console.error(error);
  } finally {
    loading.value = false;
  }
}

async function handlePagoClick() {
  const hasExistingPaymentReceipt = !!props.loanToEdit?.hasPaymentReceipt;
  if (!paymentReceiptFile.value && !hasExistingPaymentReceipt && !paymentReceiptBlobUrl.value) {
    await alert('É obrigatório anexar um comprovante de pagamento antes de marcar como pago.');
    return;
  }
  form.value.status = 'paid';
}

async function destroy() {
  if (!props.loanToEdit) return;
  if (!(await confirm('Tem certeza que deseja apagar este empréstimo?'))) return;

  try {
    loading.value = true;
    await api.delete(`/loans/${props.loanToEdit.id}`);
    emit('deleted');
    show.value = false;
  } catch (error) {
    await alert('Erro ao apagar empréstimo.');
    console.error(error);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
    <div class="bg-surface-base border border-surface-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]" :class="corBorda">
      <header class="px-6 py-4 border-b border-surface-border flex justify-end items-center gap-3 bg-surface-raised">
        <h2 v-if="props.loanToEdit?.status === 'paid'" class="flex-1 text-sm font-semibold text-expense">Empréstimo Finalizado</h2>
        <h2 v-else-if="!tipo" class="flex-1 text-sm font-semibold">Novo empréstimo</h2>
        <div v-else class="flex-1 flex items-center gap-2 min-w-0">
          <span
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border"
            :class="form.type === 'given' ? 'bg-income/15 text-income border-income/40'
              : form.type === 'received' ? 'bg-expense/15 text-expense border-expense/40'
              : 'bg-blue-500/15 text-blue-400 border-blue-500/40'"
          >
            <span class="h-2 w-2 rounded-full" :class="form.type === 'given' ? 'bg-income' : form.type === 'received' ? 'bg-expense' : 'bg-blue-400'"></span>
            {{ tipo.rotulo }}
          </span>
          <button v-if="!loanToEdit" @click="form.type = null" class="text-xs text-muted hover:text-fg">trocar</button>
        </div>
        <button @click="show = false" class="text-muted hover:text-fg transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </header>

      <!-- Passo 1: o que você vai fazer? -->
      <div v-if="!form.type" class="p-6 space-y-3">
        <p class="text-sm text-muted">O que você vai fazer?</p>
        <button
          @click="form.type = 'given'"
          class="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-income/40 bg-income/10 hover:bg-income/20 text-left transition-colors"
        >
          <span class="h-11 w-11 rounded-xl bg-income text-white flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
          </span>
          <span>
            <span class="block font-semibold text-income">{{ TIPOS.given.rotulo }}</span>
            <span class="block text-xs text-muted">{{ TIPOS.given.sub }} · entra em "A Receber"</span>
          </span>
        </button>
        <button
          @click="form.type = 'received'"
          class="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-expense/40 bg-expense/10 hover:bg-expense/20 text-left transition-colors"
        >
          <span class="h-11 w-11 rounded-xl bg-expense text-white flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>
          </span>
          <span>
            <span class="block font-semibold text-expense">{{ TIPOS.received.rotulo }}</span>
            <span class="block text-xs text-muted">{{ TIPOS.received.sub }} · entra em "A Pagar"</span>
          </span>
        </button>
        <button @click="form.type = 'fgts'" class="w-full text-center text-xs text-muted hover:text-blue-400 pt-1">
          É FGTS / governamental?
        </button>
      </div>

      <div v-else class="p-6 overflow-y-auto space-y-4">
        <div>
          <label class="block text-xs font-medium text-muted uppercase tracking-wider mb-1">Descrição</label>
          <input
            v-model="form.description"
            class="w-full bg-surface-overlay border border-surface-border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/60"
            :placeholder="form.type === 'received' ? 'Ex: Peguei com o João' : form.type === 'fgts' ? 'Ex: Saque-aniversário FGTS' : 'Ex: Emprestei para o João'"
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div :class="loanToEdit && form.type !== 'given' ? 'col-span-2' : ''">
            <label class="block text-xs font-medium text-muted uppercase tracking-wider mb-1">{{ form.type === 'received' ? 'Valor a Pagar' : 'Valor Emprestado' }}</label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted font-medium">R$</span>
              <input
                v-model="form.amount"
                type="number"
                step="0.01"
                class="w-full bg-surface-overlay border border-surface-border rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/60"
                placeholder="0,00"
              />
            </div>
          </div>

          <div v-if="form.type === 'given'">
            <label class="block text-xs font-medium text-muted uppercase tracking-wider mb-1">Valor a Receber</label>
            <div class="relative">
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted font-medium">R$</span>
              <input
                v-model="form.expectedAmount"
                type="number"
                step="0.01"
                class="w-full bg-surface-overlay border border-surface-border rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/60"
                placeholder="0,00 (Opcional)"
              />
            </div>
          </div>

          <div v-if="!loanToEdit">
            <label class="block text-xs font-medium text-muted uppercase tracking-wider mb-1">Parcelas</label>
            <input
              v-model="form.installments"
              type="number"
              min="1"
              step="1"
              class="w-full bg-surface-overlay border border-surface-border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/60"
            />
          </div>
        </div>

        <div>
          <label class="block text-xs font-medium text-muted uppercase tracking-wider mb-1">Data</label>
          <input
            v-model="form.date"
            type="date"
            class="w-full bg-surface-overlay border border-surface-border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/60 [color-scheme:dark]"
          />
        </div>

        <div>
          <label class="block text-xs font-medium text-muted uppercase tracking-wider mb-1">
            {{ form.type === 'given' ? 'Conta' : 'Conta (Opcional)' }}
          </label>
          <select
            v-model="form.accountId"
            class="w-full bg-surface-overlay border border-surface-border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/60 cursor-pointer"
          >
            <option :value="null">Selecionar conta...</option>
            <optgroup label="Contas" v-if="normalAccounts.length > 0">
              <option v-for="acc in normalAccounts" :key="acc.id" :value="acc.id">{{ acc.name }}</option>
            </optgroup>
            <optgroup label="Cartões de Crédito" v-if="creditCardAccounts.length > 0">
              <option v-for="acc in creditCardAccounts" :key="acc.id" :value="acc.id">{{ acc.name }}</option>
            </optgroup>
          </select>
        </div>

        <div v-if="loanToEdit">
          <label class="block text-xs font-medium text-muted uppercase tracking-wider mb-1">Status</label>
          <div class="grid grid-cols-2 gap-2">
            <button
              @click="form.status = 'active'"
              class="px-4 py-2.5 rounded-xl border border-surface-border font-medium transition-colors"
              :class="form.status === 'active' ? 'bg-blue-500/20 text-blue-400 border-blue-500/50' : 'bg-surface-overlay text-muted'"
            >
              Ativo
            </button>
            <button
              @click="handlePagoClick"
              class="px-4 py-2.5 rounded-xl border border-surface-border font-medium transition-colors"
              :class="form.status === 'paid' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' : 'bg-surface-overlay text-muted'"
            >
              Pago
            </button>
          </div>
        </div>


        <div>
          <label class="block text-xs font-medium text-muted uppercase tracking-wider mb-1">Comprovante do Empréstimo</label>
          
          <!-- View Existing Receipt -->
          <div v-if="loadingReceipt" class="animate-pulse bg-surface-border h-32 w-full rounded-xl mb-3"></div>
          <div v-else-if="receiptBlobUrl" class="mb-3 flex justify-center bg-surface-base border border-surface-border rounded-xl p-2 overflow-hidden max-h-64" :class="{ 'h-64': isPdf }">
            <img v-if="!isPdf" :src="receiptBlobUrl" class="max-w-full max-h-full object-contain rounded" />
            <iframe v-else :src="receiptBlobUrl" class="w-full h-full rounded" title="Comprovante PDF"></iframe>
          </div>

          <!-- Upload New Receipt -->
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            class="w-full text-sm text-muted file:mr-3 file:px-3 file:py-2 file:rounded-xl file:border-0 file:bg-surface-raised file:text-fg mb-2"
            @change="onFileChange"
          />
        </div>

        <!-- Payment Receipt -->
        <div v-if="loanToEdit || form.status === 'paid'" class="border-t border-surface-border/50 pt-4">
          <label class="block text-xs font-medium text-muted uppercase tracking-wider mb-1">Comprovante de Pagamento (Recebimento / Quitação)</label>
          
          <!-- View Existing Payment Receipt -->
          <div v-if="loadingPaymentReceipt" class="animate-pulse bg-surface-border h-32 w-full rounded-xl mb-3"></div>
          <div v-else-if="paymentReceiptBlobUrl" class="mb-3 flex justify-center bg-surface-base border border-surface-border rounded-xl p-2 overflow-hidden max-h-64" :class="{ 'h-64': isPaymentPdf }">
            <img v-if="!isPaymentPdf" :src="paymentReceiptBlobUrl" class="max-w-full max-h-full object-contain rounded" />
            <iframe v-else :src="paymentReceiptBlobUrl" class="w-full h-full rounded" title="Comprovante de Pagamento PDF"></iframe>
          </div>

          <!-- Upload New Payment Receipt -->
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            class="w-full text-sm text-muted file:mr-3 file:px-3 file:py-2 file:rounded-xl file:border-0 file:bg-surface-raised file:text-fg"
            @change="onPaymentFileChange"
          />
        </div>
      </div>

      <footer class="p-6 border-t border-surface-border bg-surface-raised/30 flex justify-between gap-3">
        <button
          v-if="loanToEdit"
          @click="destroy"
          :disabled="loading"
          class="px-4 py-2 rounded-xl text-red-400 hover:bg-red-400/10 transition-colors font-medium text-sm disabled:opacity-50"
        >
          Apagar
        </button>
        <div v-else class="flex-1"></div>

        <div class="flex gap-3">
          <button
            @click="show = false"
            :disabled="loading"
            class="px-4 py-2 rounded-xl text-muted hover:bg-surface-overlay transition-colors font-medium text-sm disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            @click="save"
            v-if="form.type"
            :disabled="loading || !form.description || !form.amount"
            class="px-6 py-2 rounded-xl text-white font-medium text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
            :class="corSalvar"
          >
            <div v-if="loading" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            Salvar
          </button>
        </div>
      </footer>
    </div>
  </div>
</template>
