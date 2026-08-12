<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { api } from '@moneyapp/api-client';
import { useConfirmDialog } from '../../composables/useConfirmDialog';

const open = defineModel<boolean>('open', { default: false });
const props = defineProps<{
  subscription?: any | null;
  // When set the modal links the picked transaction to this card's invoice
  // instead of to a subscription.
  creditCard?: any | null;
  categoriesMap?: Map<string, any>;
}>();

const emit = defineEmits<{
  (e: 'linked'): void;
}>();

const { alert } = useConfirmDialog();

const loading = ref(false);
const linkingId = ref<string | null>(null);
const transactionsList = ref<any[]>([]);
const search = ref('');

const brl = (n: number | string) =>
  Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const isCardMode = computed(() => !!props.creditCard);

const subscriptionId = computed(() => {
  if (!props.subscription) return null;
  return props.subscription.originalItem?.id || props.subscription.id?.replace(/^sub-/, '').replace(/-\d{4}-\d{2}.*$/, '') || props.subscription.id;
});

const targetAmount = computed(() => {
  if (isCardMode.value) return Math.abs(Number(props.creditCard.currentBalance));
  if (!props.subscription) return 0;
  return Math.abs(Number(props.subscription.amount));
});

// Only expenses can settle an invoice, and an expense already booked on the card
// is a purchase — never the payment of its own fatura.
function isEligible(tx: any) {
  if (!isCardMode.value) return true;
  return tx.type === 'expense' && tx.accountId !== props.creditCard.id;
}

// Already-linked entries stay visible (greyed out) so the user understands why
// the transaction they were looking for cannot be picked again.
function isAlreadyLinked(tx: any) {
  return isCardMode.value ? !!tx.invoiceCardId || !!tx.subscriptionId : !!tx.subscriptionId;
}

const linkErrors: Record<string, string> = {
  transaction_already_linked: 'Este lançamento já está vinculado a uma fatura.',
  transaction_linked_to_subscription: 'Este lançamento já está vinculado a uma assinatura.',
  transaction_must_be_an_expense: 'Só é possível vincular lançamentos de saída (despesa).',
  transaction_belongs_to_the_card: 'Este lançamento é uma compra do próprio cartão.',
  account_is_not_a_credit_card: 'Esta conta não é um cartão de crédito.',
  transaction_not_found: 'Lançamento não encontrado.',
  card_not_found: 'Cartão não encontrado.',
};

async function loadTransactions() {
  if (!open.value) return;
  loading.value = true;
  try {
    const list = await api.get<any[]>('/transactions?limit=200&sort=date_desc');
    transactionsList.value = list;
  } catch (err) {
    console.error('Failed to load transactions for linking', err);
  } finally {
    loading.value = false;
  }
}

watch(open, (val) => {
  if (val) {
    // In card mode the description rarely matches the card name — leave the
    // search open and let the exact-amount sorting surface the candidate.
    search.value = isCardMode.value ? '' : props.subscription?.description?.slice(0, 10) || '';
    loadTransactions();
  }
}, { immediate: true });

const filteredTransactions = computed(() => {
  const term = search.value.trim().toLowerCase();
  return transactionsList.value.filter((t) => {
    if (!isEligible(t)) return false;
    if (term) {
      const descMatch = t.description.toLowerCase().includes(term);
      const amountMatch = String(Math.abs(Number(t.amount))).includes(term);
      if (!descMatch && !amountMatch) return false;
    }
    return true;
  }).sort((a, b) => {
    // Exact amount match first
    const matchA = Math.abs(Number(a.amount)) === targetAmount.value ? 1 : 0;
    const matchB = Math.abs(Number(b.amount)) === targetAmount.value ? 1 : 0;
    if (matchA !== matchB) return matchB - matchA;
    return new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
  });
});

async function handleLink(tx: any) {
  if (!isCardMode.value && !subscriptionId.value) return;

  linkingId.value = tx.id;
  try {
    if (isCardMode.value) {
      await api.post(`/accounts/${props.creditCard.id}/link-invoice-payment`, {
        transactionId: tx.id,
      });
    } else {
      await api.patch(`/transactions/${tx.id}`, {
        subscriptionId: subscriptionId.value,
        status: 'paid'
      });
    }

    await alert(`Lançamento "${tx.description}" vinculado com sucesso!`);
    open.value = false;
    emit('linked');
  } catch (err: any) {
    console.error('Failed to link transaction', err);
    await alert(linkErrors[err?.body?.error] || 'Erro ao vincular lançamento.');
  } finally {
    linkingId.value = null;
  }
}
</script>

<template>
  <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
    <div class="bg-surface-raised border border-surface-border rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
      <!-- Header -->
      <header class="px-6 py-4 border-b border-surface-border flex justify-between items-center bg-surface-overlay/50">
        <div>
          <h3 class="text-lg font-bold text-white">Vincular Lançamento Existente</h3>
          <p class="text-xs text-muted">
            {{ isCardMode
              ? 'Selecione a saída já lançada no Livro Caixa que pagou esta fatura.'
              : 'Selecione uma transação já lançada no Livro Caixa para vincular.' }}
          </p>
        </div>
        <button @click="open = false" class="text-muted hover:text-white transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </header>

      <!-- Target Banner -->
      <div v-if="isCardMode" class="px-6 py-3 bg-surface-overlay border-b border-surface-border/50 flex items-center gap-3">
        <img v-if="props.creditCard.customIconUrl" :src="props.creditCard.customIconUrl" class="w-7 h-7 rounded-md object-contain shrink-0 border border-surface-border" />
        <div class="min-w-0 flex-1">
          <span class="text-[10px] font-bold uppercase tracking-wider text-accent">Fatura do Cartão</span>
          <p class="text-sm font-semibold text-white truncate">{{ props.creditCard.name }}</p>
        </div>
        <div class="text-right shrink-0">
          <span class="text-sm font-bold text-expense tabular-nums">{{ brl(targetAmount) }}</span>
        </div>
      </div>

      <div v-else-if="props.subscription" class="px-6 py-3 bg-surface-overlay border-b border-surface-border/50 flex items-center justify-between gap-4">
        <div class="min-w-0">
          <span class="text-[10px] font-bold uppercase tracking-wider text-accent">Assinatura / Mensalidade</span>
          <p class="text-sm font-semibold text-white truncate">{{ props.subscription.description }}</p>
        </div>
        <div class="text-right shrink-0">
          <span class="text-sm font-bold text-expense tabular-nums">{{ brl(targetAmount) }}</span>
        </div>
      </div>

      <!-- Search input -->
      <div class="p-4 border-b border-surface-border/50">
        <input
          v-model="search"
          type="text"
          placeholder="Buscar no Livro Caixa por descrição ou valor..."
          class="w-full bg-surface-base border border-surface-border rounded-xl px-4 py-2.5 text-sm text-white placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent/60"
        />
      </div>

      <!-- Content list -->
      <div class="p-4 flex-1 overflow-y-auto space-y-3 custom-scrollbar">
        <div v-if="loading" class="space-y-3">
          <div v-for="i in 4" :key="i" class="skeleton h-16 w-full rounded-xl" />
        </div>

        <div v-else-if="filteredTransactions.length === 0" class="py-12 flex flex-col items-center justify-center text-center border-2 border-dashed border-surface-border/50 rounded-xl">
          <p class="text-muted text-sm font-medium px-6">
            {{ isCardMode && !search.trim()
              ? 'Nenhuma saída no Livro Caixa disponível para vincular a esta fatura.'
              : 'Nenhum lançamento encontrado no Livro Caixa.' }}
          </p>
          <button v-if="search.trim()" @click="search = ''" class="mt-2 text-xs text-accent hover:underline font-semibold">Limpar Busca</button>
        </div>

        <template v-else>
          <div
            v-for="tx in filteredTransactions"
            :key="tx.id"
            class="p-3 bg-surface-base border border-surface-border/80 hover:border-accent/50 rounded-xl flex items-center justify-between gap-3 transition-all group"
            :class="{ 'border-accent/40 bg-accent/5': Math.abs(Number(tx.amount)) === targetAmount }"
          >
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="font-medium text-sm text-white truncate">{{ tx.description }}</span>
                <span v-if="Math.abs(Number(tx.amount)) === targetAmount" class="px-1.5 py-0.5 rounded bg-accent/20 text-accent text-[9px] font-bold uppercase tracking-wider shrink-0">
                  Valor Exato
                </span>
                <span v-if="isAlreadyLinked(tx)" class="px-1.5 py-0.5 rounded bg-income/20 text-income text-[9px] font-bold uppercase tracking-wider shrink-0">
                  Já Vinculado
                </span>
              </div>
              
              <div class="flex items-center gap-3 mt-1 text-xs text-muted">
                <span>{{ new Date(tx.occurredAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'UTC' }) }}</span>
                <span v-if="tx.categoryId && categoriesMap?.get(tx.categoryId)" class="truncate">
                  &bull; {{ categoriesMap.get(tx.categoryId)?.name }}
                </span>
              </div>
            </div>

            <div class="flex items-center gap-3 shrink-0">
              <span class="font-bold text-sm tabular-nums" :class="Number(tx.amount) < 0 ? 'text-expense' : 'text-income'">
                {{ brl(Math.abs(Number(tx.amount))) }}
              </span>

              <button
                @click="handleLink(tx)"
                :disabled="linkingId === tx.id || (isCardMode && isAlreadyLinked(tx))"
                :title="isCardMode && isAlreadyLinked(tx) ? 'Já vinculado a uma fatura' : 'Vincular'"
                class="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-bold hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 shadow-sm"
              >
                <div v-if="linkingId === tx.id" class="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>Vincular</span>
              </button>
            </div>
          </div>
        </template>
      </div>

      <!-- Footer -->
      <footer class="p-4 border-t border-surface-border bg-surface-overlay/30 flex justify-end">
        <button
          @click="open = false"
          class="px-4 py-2 rounded-xl border border-surface-border text-muted hover:text-white transition-colors text-sm font-semibold"
        >
          Cancelar
        </button>
      </footer>
    </div>
  </div>
</template>
