<script setup lang="ts">
import { ref, watch } from 'vue';
import { api, fileToBase64 } from '@moneyapp/api-client';
import type { LoanItem, Account } from '@moneyapp/models';
import { useAuthStore } from '../stores/auth';
import { useConfirmDialog } from '../composables/useConfirmDialog';

const { confirm, alert } = useConfirmDialog();

const show = defineModel<boolean>('show', { default: false });
const props = defineProps<{
  loanToEdit: LoanItem | null;
  defaultType?: 'given' | 'received' | 'fgts';
}>();

const emit = defineEmits<{
  (e: 'saved'): void;
  (e: 'deleted'): void;
}>();

const loading = ref(false);

const form = ref({
  description: '',
  amount: '',
  accountId: null as string | null,
  installments: 1,
  date: new Date().toISOString().split('T')[0] as string,
  type: 'given' as 'given' | 'received' | 'fgts',
  status: 'active' as 'active' | 'paid',
});

const accounts = ref<Account[]>([]);

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

function resetForm() {
  if (props.loanToEdit) {
    form.value = {
      description: props.loanToEdit.description,
      amount: String(props.loanToEdit.amount),
      accountId: props.loanToEdit.accountId || null,
      installments: 1,
      date: props.loanToEdit.date.split('T')[0] as string,
      type: props.loanToEdit.type,
      status: props.loanToEdit.status,
    };
  } else {
    form.value = {
      description: '',
      amount: '',
      accountId: null,
      installments: 1,
      date: new Date().toISOString().split('T')[0] as string,
      type: props.defaultType || 'given',
      status: 'active',
    };
  }
}

watch(show, async (val) => {
  if (val) {
    if (accounts.value.length === 0) {
      try {
        accounts.value = await api.get<Account[]>('/accounts');
      } catch (e) {
        console.error('Failed to load accounts', e);
      }
    }
    resetForm();
    receiptFile.value = null;
    receiptBlobUrl.value = null;
    isPdf.value = false;

    if (props.loanToEdit?.hasReceipt) {
      loadingReceipt.value = true;
      try {
        const BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';
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
  }
}, { immediate: true });

async function save() {
  const payload = {
    description: form.value.description,
    amount: Number(String(form.value.amount).replace(',', '.')),
    accountId: form.value.accountId || undefined,
    date: new Date(form.value.date as string).toISOString(),
    type: form.value.type,
    status: form.value.status,
    installments: form.value.installments,
    receipt: receiptFile.value
      ? ((await fileToBase64(receiptFile.value)) as { mimeType: string, base64: string })
      : undefined,
  };

  try {
    loading.value = true;
    if (props.loanToEdit) {
      await api.put(`/loans/${props.loanToEdit.id}`, payload);
    } else {
      await api.post('/loans', payload);
    }
    emit('saved');
    show.value = false;
  } catch (error) {
    await alert('Erro ao salvar empréstimo.');
    console.error(error);
  } finally {
    loading.value = false;
  }
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
  <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
    <div class="bg-surface-base border border-surface-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
      <header class="px-6 py-4 border-b border-surface-border flex justify-end items-center bg-surface-raised">
        <button @click="show = false" class="text-muted hover:text-white transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </header>

      <div class="p-6 overflow-y-auto space-y-4">
        <div>
          <label class="block text-xs font-medium text-muted uppercase tracking-wider mb-1">Descrição</label>
          <input
            v-model="form.description"
            class="w-full bg-surface-overlay border border-surface-border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/60"
            placeholder="Ex: Empréstimo do João"
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-medium text-muted uppercase tracking-wider mb-1">Valor</label>
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
          <div v-else></div>
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
          <label class="block text-xs font-medium text-muted uppercase tracking-wider mb-1">Conta (Opcional)</label>
          <select
            v-model="form.accountId"
            class="w-full bg-surface-overlay border border-surface-border rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-accent/60 cursor-pointer"
          >
            <option :value="null">Selecionar conta...</option>
            <option v-for="acc in accounts" :key="acc.id" :value="acc.id">{{ acc.name }}</option>
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
              @click="form.status = 'paid'"
              class="px-4 py-2.5 rounded-xl border border-surface-border font-medium transition-colors"
              :class="form.status === 'paid' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' : 'bg-surface-overlay text-muted'"
            >
              Pago
            </button>
          </div>
        </div>

        <div>
          <label class="block text-xs font-medium text-muted uppercase tracking-wider mb-1">Comprovante</label>
          
          <!-- View Existing Receipt -->
          <div v-if="loadingReceipt" class="animate-pulse bg-surface-border h-32 w-full rounded-xl mb-3"></div>
          <div v-else-if="receiptBlobUrl" class="mb-3 flex justify-center bg-surface-base border border-surface-border rounded-xl p-2 overflow-hidden max-h-64">
            <img v-if="!isPdf" :src="receiptBlobUrl" class="max-w-full max-h-full object-contain rounded" />
            <a v-else :href="receiptBlobUrl" target="_blank" class="px-4 py-2 bg-accent rounded-xl text-white font-medium text-sm hover:bg-accent/90 transition-colors">Visualizar PDF Anexado</a>
          </div>

          <!-- Upload New Receipt -->
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf"
            class="w-full text-sm text-muted file:mr-3 file:px-3 file:py-2 file:rounded-xl file:border-0 file:bg-surface-raised file:text-white"
            @change="onFileChange"
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
            :disabled="loading || !form.description || !form.amount"
            class="px-6 py-2 rounded-xl bg-accent text-white font-medium text-sm hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <div v-if="loading" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            Salvar
          </button>
        </div>
      </footer>
    </div>
  </div>
</template>
