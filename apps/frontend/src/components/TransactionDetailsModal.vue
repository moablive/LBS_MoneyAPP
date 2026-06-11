<script setup lang="ts">
import { ref, watch } from 'vue';
import { CheckCircleIcon as CheckCircle2, ClockIcon as Clock, BuildingLibraryIcon as Landmark, CalendarIcon as Calendar, CurrencyDollarIcon as DollarSign, DocumentTextIcon as FileText } from '@heroicons/vue/24/outline';
import Modal from './Modal.vue';
import { useAuthStore } from '../stores/auth';

import type { Transaction } from '@moneyapp/models';

const open = defineModel<boolean>('open', { default: false });
const props = defineProps<{
  transaction: Transaction | null;
  accountName?: string;
  categoryName?: string;
  categoryColor?: string;
}>();

const emit = defineEmits<{
  (e: 'edit'): void;
  (e: 'delete'): void;
}>();

const receiptBlobUrl = ref<string | null>(null);
const loadingReceipt = ref(false);
const isPdf = ref(false);
const showFullscreenReceipt = ref(false);

const brl = (n: number | string) =>
  Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatDay = (iso: string) => {
  if (!iso) return '';
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  const day = String(d.getUTCDate()).padStart(2, '0');
  const monthNum = String(d.getUTCMonth() + 1).padStart(2, '0');
  let monthName = d.toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' });
  monthName = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  return `${day}/${monthNum} - ${monthName}`;
};



watch(() => props.transaction, async (t) => {
  if (t && t.hasReceipt) {
    loadingReceipt.value = true;
    receiptBlobUrl.value = null;
    try {
      const BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';
      const auth = useAuthStore();
      const headers: Record<string, string> = {};
      if (auth.token) headers.Authorization = `Bearer ${auth.token}`;
      
      const res = await fetch(`${BASE}/transactions/${t.id}/receipt`, { headers });
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
  } else {
    receiptBlobUrl.value = null;
  }
}, { immediate: true });
</script>

<template>
  <Modal :open="open" @close="open = false">
    <div v-if="transaction" class="p-6 space-y-6">
      <header>
        <h2 class="text-2xl font-bold tracking-tight text-white">Detalhes da Transação</h2>
      </header>

      <div class="space-y-4">
        <div class="flex items-center gap-3 bg-surface-raised p-4 rounded-xl border border-surface-border">
          <div class="flex-1 min-w-0">
            <p class="text-sm text-zinc-400">Descrição</p>
            <p class="font-semibold text-white truncate text-base">{{ transaction.description }}</p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="bg-surface-raised p-4 rounded-xl border border-surface-border">
            <p class="text-sm text-zinc-400 mb-1 flex items-center gap-1"><DollarSign class="w-4 h-4" /> Valor</p>
            <p 
              class="tabular-nums font-bold text-xl"
              :class="transaction.type === 'expense' ? 'text-expense' : 'text-income'"
            >
              {{ transaction.type === 'expense' && !transaction.amount.toString().startsWith('-') ? '-' : '' }}{{ brl(transaction.amount) }}
            </p>
          </div>
          
          <div class="bg-surface-raised p-4 rounded-xl border border-surface-border">
            <p class="text-sm text-zinc-400 mb-1 flex items-center gap-1"><Calendar class="w-4 h-4" /> Data</p>
            <p class="font-semibold text-white">{{ formatDay(transaction.occurredAt) }}</p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="bg-surface-raised p-4 rounded-xl border border-surface-border">
            <p class="text-sm text-zinc-400 mb-1 flex items-center gap-1"><Landmark class="w-4 h-4" /> Conta</p>
            <p class="font-semibold text-white truncate">{{ accountName || 'Sem Conta' }}</p>
          </div>

          <div class="bg-surface-raised p-4 rounded-xl border border-surface-border">
            <p class="text-sm text-zinc-400 mb-1 flex items-center gap-1">
              <div v-if="categoryColor" class="w-2 h-2 rounded-full mr-1" :style="{ backgroundColor: categoryColor }"></div>
              Categoria
            </p>
            <p class="font-semibold text-white truncate">{{ categoryName || 'Sem Categoria' }}</p>
          </div>
        </div>

        <div class="bg-surface-raised p-4 rounded-xl border border-surface-border flex items-center justify-between">
          <div class="flex items-center gap-2">
            <p class="text-sm text-zinc-400">Status</p>
            <div 
              class="flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full"
              :class="transaction.status === 'paid' ? 'bg-income/10 text-income border border-income/20' : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'"
            >
              <CheckCircle2 v-if="transaction.status === 'paid'" class="w-3 h-3" />
              <Clock v-else class="w-3 h-3" />
              {{ transaction.status === 'paid' ? 'Pago' : 'Pendente' }}
            </div>
          </div>
        </div>

        <div class="bg-surface-raised p-4 rounded-xl border border-surface-border space-y-3">
          <p class="text-sm text-zinc-400 flex items-center gap-1"><FileText class="w-4 h-4" /> Comprovante</p>
          
          <div v-if="!transaction.hasReceipt" class="text-sm text-muted py-2">
            Nenhum comprovante anexado.
          </div>
          <div v-else-if="loadingReceipt" class="animate-pulse flex space-x-4">
            <div class="rounded bg-surface-border h-32 w-full"></div>
          </div>
          <div v-else-if="receiptBlobUrl" class="flex justify-center bg-surface-base rounded-lg p-2 overflow-hidden max-h-64">
            <img 
              v-if="!isPdf" 
              :src="receiptBlobUrl" 
              class="max-w-full max-h-full object-contain rounded cursor-pointer hover:opacity-90 transition-opacity" 
              @click="showFullscreenReceipt = true"
            />
            <a v-else :href="receiptBlobUrl" target="_blank" class="px-4 py-3 bg-accent rounded-xl text-white font-medium text-sm hover:bg-accent/90 transition-colors">Abrir PDF Anexado</a>
          </div>
          <div v-else class="text-sm text-muted py-2">
            Não foi possível carregar o comprovante.
          </div>
        </div>
      </div>
      
      <div class="pt-4 flex justify-end gap-2">
        <button
          @click="emit('delete')"
          class="px-5 py-2.5 rounded-xl border border-expense text-expense text-sm font-bold hover:bg-expense/10 transition-colors"
        >
          Excluir
        </button>
        <button
          @click="emit('edit')"
          class="px-5 py-2.5 rounded-xl border border-accent text-accent text-sm font-bold hover:bg-accent/10 transition-colors"
        >
          Editar
        </button>
        <button
          @click="open = false"
          class="px-5 py-2.5 rounded-xl border border-surface-border text-white text-sm font-bold hover:bg-surface-raised transition-colors"
        >
          Fechar
        </button>
      </div>
    </div>
  </Modal>

  <Teleport to="body">
    <transition name="modal">
      <div 
        v-if="showFullscreenReceipt && receiptBlobUrl" 
        class="fixed inset-0 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 cursor-zoom-out"
        style="z-index: 9999;"
        @click="showFullscreenReceipt = false"
      >
        <img 
          :src="receiptBlobUrl" 
          class="max-w-full max-h-full object-contain rounded-xl shadow-2xl" 
        />
        <button 
          @click.stop="showFullscreenReceipt = false"
          class="absolute top-4 right-4 text-white hover:text-gray-300 bg-black/50 hover:bg-black/80 p-2 rounded-full transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </transition>
  </Teleport>
</template>
