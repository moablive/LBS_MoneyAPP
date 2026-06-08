<script setup lang="ts">
import { ref, watch, useId, computed } from 'vue';
import { api, fileToBase64 } from '@moneyapp/api-client';
import type { AccountType, CreateAccountInput, Account } from '@moneyapp/models';
import Modal from './Modal.vue';

const open = defineModel<boolean>('open', { default: false });
const props = defineProps<{ account?: Account | null }>();
const emit = defineEmits<{
  (e: 'created', value: unknown): void;
}>();

const formId = useId();

const name = ref('');
const type = ref<AccountType>('checking');
const bankCode = ref<string | null>(null);
const currentBalance = ref<number>(0);
const freezeBalance = ref<boolean>(false);
// Switch exposto ao usuário: marcado = afeta o saldo (= não congelado).
const affectsBalance = computed<boolean>({
  get: () => !freezeBalance.value,
  set: (v) => { freezeBalance.value = !v; },
});
const creditLimit = ref<number | null>(null);
const closingDay = ref<number | null>(null);
const dueDay = ref<number | null>(null);
const customFile = ref<File | null>(null);
const customPreview = ref<string | null>(null);
const submitting = ref(false);
const error = ref<string | null>(null);

const rawLogos = import.meta.glob('/public/logos_bancarios/*');
const predefinedLogos = Object.keys(rawLogos).map(k => k.replace('/public', ''));
const selectedPredefined = ref<string | null>(null);

function selectPredefined(logo: string) {
  if (selectedPredefined.value === logo) {
    selectedPredefined.value = null;
  } else {
    selectedPredefined.value = logo;
    customPreview.value = null;
    customFile.value = null;
  }
}

const typeOptions: { value: AccountType; label: string }[] = [
  { value: 'checking',    label: 'Conta Corrente' },
  { value: 'savings',     label: 'Poupança' },
  { value: 'credit_card', label: 'Cartão de Crédito' },
  { value: 'wallet',      label: 'Carteira / PIX' },
  { value: 'investment',  label: 'Investimento' },
  { value: 'other',       label: 'Outro' },
];

watch(
  open,
  (v) => {
    if (!v) return;
    if (props.account) {
      name.value = props.account.name;
      type.value = props.account.type;
      bankCode.value = props.account.bankCode;
      currentBalance.value = Number(props.account.currentBalance);
      freezeBalance.value = props.account.freezeBalance ?? false;
      creditLimit.value = props.account.creditLimit ? Number(props.account.creditLimit) : null;
      closingDay.value = props.account.closingDay ? Number(props.account.closingDay) : null;
      dueDay.value = props.account.dueDay ? Number(props.account.dueDay) : null;
      if (props.account.customIconUrl && props.account.customIconUrl.startsWith('/logos_bancarios')) {
        selectedPredefined.value = props.account.customIconUrl;
        customPreview.value = null;
      } else {
        selectedPredefined.value = null;
        customPreview.value = props.account.customIconUrl;
      }
    } else {
      name.value = '';
      type.value = 'checking';
      bankCode.value = null;
      currentBalance.value = 0;
      freezeBalance.value = false;
      creditLimit.value = null;
      closingDay.value = null;
      dueDay.value = null;
      customFile.value = null;
      customPreview.value = null;
      selectedPredefined.value = null;
    }
    error.value = null;
  },
  { immediate: true }
);



async function onCustomIcon(e: Event) {
  const input = e.target as HTMLInputElement;
  const f = input.files?.[0] ?? null;
  customFile.value = f;
  if (!f) {
    customPreview.value = null;
    return;
  }
  const { base64, mimeType } = await fileToBase64(f);
  customPreview.value = `data:${mimeType};base64,${base64}`;
  selectedPredefined.value = null;
}

async function submit() {
  if (!name.value.trim()) {
    error.value = 'Dê um nome para a conta.';
    return;
  }
  submitting.value = true;
  error.value = null;
  try {
    const payload: CreateAccountInput = {
      name: name.value.trim(),
      type: type.value,
      bankCode: bankCode.value,
      customIconUrl: customPreview.value || selectedPredefined.value,
      currentBalance: Number(currentBalance.value) || 0,
      freezeBalance: freezeBalance.value,
      ...(type.value === 'credit_card' && {
        creditLimit: creditLimit.value ? Number(creditLimit.value) : null,
        closingDay: closingDay.value ? Number(closingDay.value) : null,
        dueDay: dueDay.value ? Number(dueDay.value) : null,
      }),
    };
    let saved;
    if (props.account) {
      saved = await api.patch<unknown>(`/accounts/${props.account.id}`, payload);
    } else {
      saved = await api.post<unknown>('/accounts', payload);
    }
    emit('created', saved);
    window.dispatchEvent(new CustomEvent('transaction-created'));
    open.value = false;
  } catch {
    error.value = 'Não foi possível criar a conta.';
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <Modal :open="open" :title="account ? 'Editar Conta' : 'Nova Conta'" @close="open = false">
    <form class="space-y-5" @submit.prevent="submit">
      <!-- Custom icon upload -->
      <section class="space-y-3">
        <h3 class="text-xs uppercase tracking-wide text-muted">Ícone da Conta</h3>

        <div v-if="predefinedLogos.length > 0" class="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
          <button
            v-for="logo in predefinedLogos"
            :key="logo"
            type="button"
            @click="selectPredefined(logo)"
            class="flex-shrink-0 w-12 h-12 rounded-xl border-2 transition-all p-1"
            :class="selectedPredefined === logo ? 'border-accent bg-accent/10' : 'border-surface-border bg-surface-overlay hover:border-accent/50'"
          >
            <img :src="logo" class="w-full h-full object-contain" :alt="logo" />
          </button>
        </div>

        <div class="flex items-center gap-3 pt-1">
          <label class="flex items-center gap-2 text-xs text-muted cursor-pointer
                        hover:text-slate-100 transition-colors">
            <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" class="hidden" @change="onCustomIcon" />
            <span class="px-3 py-1.5 rounded-lg border border-surface-border">
              {{ customPreview ? 'Trocar ícone…' : 'Ou subir ícone próprio…' }}
            </span>
          </label>
          <img
            v-if="customPreview"
            :src="customPreview"
            alt="Ícone personalizado"
            class="h-9 w-9 rounded-lg object-contain border border-surface-border bg-surface-overlay"
          />
        </div>
      </section>

      <!-- Account details -->
      <section class="grid grid-cols-2 gap-3">
        <label :for="formId + '-name'" class="block space-y-1 col-span-2">
          <span class="text-xs uppercase tracking-wide text-muted">Nome da conta</span>
          <input
            :id="formId + '-name'"
            v-model="name"
            required
            maxlength="120"
            placeholder="..."
            class="w-full bg-surface-overlay border border-surface-border rounded-xl px-3 py-2
                   focus:outline-none focus:ring-2 focus:ring-accent/60"
          />
        </label>

        <label :for="formId + '-type'" class="block space-y-1">
          <span class="text-xs uppercase tracking-wide text-muted">Tipo</span>
          <select
            :id="formId + '-type'"
            v-model="type"
            class="w-full bg-surface-overlay border border-surface-border rounded-xl px-3 py-2"
          >
            <option v-for="opt in typeOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </label>

        <label :for="formId + '-balance'" class="block space-y-1">
          <span class="text-xs uppercase tracking-wide text-muted">Saldo atual (R$)</span>
          <input
            :id="formId + '-balance'"
            v-model.number="currentBalance"
            type="number"
            step="0.01"
            class="w-full bg-surface-overlay border border-surface-border rounded-xl px-3 py-2 tabular-nums
                   focus:outline-none focus:ring-2 focus:ring-accent/60"
          />
        </label>
      </section>

      <!-- Afeta o saldo? (desmarcado = conta histórica/encerrada) -->
      <section class="flex items-start justify-between gap-3 rounded-xl border border-surface-border bg-surface-overlay/40 px-3 py-3">
        <div class="min-w-0">
          <div class="text-sm font-medium">
            {{ type === 'credit_card' ? 'Afeta a soma de Cartões' : 'Afeta o saldo total' }}
          </div>
          <p v-if="type === 'credit_card'" class="text-xs text-muted mt-0.5">
            <strong>Marcado:</strong> a fatura entra no cálculo do painel "Cartões" e é atualizada pelos lançamentos.
            <strong>Desmarcado:</strong> cartão inativo/encerrado — fica fora da soma das faturas e congela como referência.
          </p>
          <p v-else class="text-xs text-muted mt-0.5">
            <strong>Marcado:</strong> a conta entra no saldo total e é alterada pelos pagamentos.
            <strong>Desmarcado:</strong> conta histórica/encerrada — fica fora do saldo total e o
            valor congela como referência.
          </p>
        </div>
        <label class="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
          <input type="checkbox" v-model="affectsBalance" class="sr-only peer" />
          <div class="w-11 h-6 bg-surface-overlay peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent border border-surface-border"></div>
        </label>
      </section>

      <!-- Credit Card details -->
      <section v-if="type === 'credit_card'" class="grid grid-cols-3 gap-3">
        <label :for="formId + '-limit'" class="block space-y-1">
          <span class="text-xs uppercase tracking-wide text-muted">Limite (R$)</span>
          <input
            :id="formId + '-limit'"
            v-model.number="creditLimit"
            type="number"
            step="0.01"
            class="w-full bg-surface-overlay border border-surface-border rounded-xl px-3 py-2 tabular-nums focus:outline-none focus:ring-2 focus:ring-accent/60"
          />
        </label>
        <label :for="formId + '-closing'" class="block space-y-1">
          <span class="text-xs uppercase tracking-wide text-muted">Fechamento</span>
          <input
            :id="formId + '-closing'"
            v-model.number="closingDay"
            type="number"
            min="1" max="31"
            placeholder="Dia"
            class="w-full bg-surface-overlay border border-surface-border rounded-xl px-3 py-2 tabular-nums focus:outline-none focus:ring-2 focus:ring-accent/60"
          />
        </label>
        <label :for="formId + '-due'" class="block space-y-1">
          <span class="text-xs uppercase tracking-wide text-muted">Vencimento</span>
          <input
            :id="formId + '-due'"
            v-model.number="dueDay"
            type="number"
            min="1" max="31"
            placeholder="Dia"
            class="w-full bg-surface-overlay border border-surface-border rounded-xl px-3 py-2 tabular-nums focus:outline-none focus:ring-2 focus:ring-accent/60"
          />
        </label>
      </section>

      <!-- Preview -->
      <section class="card !p-3 flex items-center gap-3">
        <img
          :src="customPreview || selectedPredefined || '/banks/generic.svg'"
          alt=""
          class="h-10 w-10 rounded-xl object-contain bg-surface-overlay border border-surface-border p-0.5"
        />
        <div class="min-w-0">
          <div class="font-medium truncate">{{ name || 'Nome da conta' }}</div>
          <div class="text-xs text-muted">
            {{ typeOptions.find(o => o.value === type)?.label }}

          </div>
        </div>
      </section>

      <p v-if="error" class="text-sm text-expense">{{ error }}</p>

      <div class="flex justify-end gap-2">
        <button
          type="button"
          class="px-4 py-2 rounded-xl border border-surface-border text-muted hover:text-slate-100"
          @click="open = false"
        >Cancelar</button>
        <button
          type="submit"
          :disabled="submitting"
          class="px-4 py-2 rounded-xl bg-accent text-white font-medium disabled:opacity-60"
        >{{ submitting ? 'Salvando…' : 'Salvar conta' }}</button>
      </div>
    </form>
  </Modal>
</template>
