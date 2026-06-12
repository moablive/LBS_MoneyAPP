<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '@moneyapp/api-client';
import type { Account } from '@moneyapp/models';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const auth = useAuthStore();
const requireReceipts = ref(auth.user?.settings?.requireReceipts ?? true);
const saving = ref(false);
const message = ref('');

// --- Calendar Token ---
const calendarToken = ref<string | null>(null);
const generatingToken = ref(false);

const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const calendarUrl = computed(() => {
  if (!calendarToken.value) return '';
  return `${backendUrl.replace('/api', '')}/api/calendar/${calendarToken.value}.ics`;
});

const loadCalendarToken = async () => {
  try {
    const res = await api.get<{token: string}>('/users/me/calendar-token');
    calendarToken.value = res.token;
  } catch {
    // Ignore if no token
  }
};

const generateCalendarToken = async () => {
  generatingToken.value = true;
  try {
    const res = await api.post<{token: string}>('/users/me/calendar-token', {});
    calendarToken.value = res.token;
  } catch {
    message.value = 'Erro ao gerar link de sincronização.';
    setTimeout(() => { message.value = '' }, 3000);
  } finally {
    generatingToken.value = false;
  }
};

const copyCalendarUrl = async () => {
  if (!calendarUrl.value) return;
  try {
    await navigator.clipboard.writeText(calendarUrl.value);
    message.value = 'Link copiado!';
    setTimeout(() => { message.value = '' }, 3000);
  } catch {
    message.value = 'Erro ao copiar.';
  }
};

// --- Contas: congelar saldo (conta histórica) ---
const accounts = ref<Account[]>([]);
const loadingAccounts = ref(true);
const savingAccountId = ref<string | null>(null);

const brl = (v: string | number) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

onMounted(async () => {
  try {
    accounts.value = await api.get<Account[]>('/accounts');
  } catch {
    // silencioso — a seção apenas não lista contas
  } finally {
    loadingAccounts.value = false;
  }
  await loadCalendarToken();
});

// Switch marcado = "afeta o saldo" (freezeBalance = false).
// Switch desmarcado = não afeta (freezeBalance = true, conta histórica).
async function toggleAffects(a: Account, e: Event) {
  const affects = (e.target as HTMLInputElement).checked;
  a.freezeBalance = !affects; // atualização otimista
  savingAccountId.value = a.id;
  message.value = '';
  try {
    await api.patch(`/accounts/${a.id}`, { freezeBalance: a.freezeBalance });
  } catch {
    a.freezeBalance = !a.freezeBalance; // reverte em caso de erro
    message.value = 'Erro ao salvar conta.';
    setTimeout(() => { message.value = '' }, 3000);
  } finally {
    savingAccountId.value = null;
  }
}

async function save() {
  saving.value = true;
  message.value = '';
  try {
    await auth.updateSettings({ requireReceipts: requireReceipts.value });
    message.value = 'Configurações salvas com sucesso!';
    setTimeout(() => { message.value = '' }, 3000);
  } catch (err) {
    message.value = 'Erro ao salvar configurações.';
  } finally {
    saving.value = false;
  }
}

function logout() {
  auth.logout();
  router.push('/login');
}
</script>

<template>
  <div class="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
    <header class="mb-8">
      <RouterLink
        to="/"
        class="inline-flex items-center gap-2 mb-4 px-3 py-2 rounded-xl border border-surface-border bg-surface-raised text-sm font-medium text-muted hover:text-slate-100 hover:bg-surface-overlay transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
        Voltar ao Dashboard
      </RouterLink>
      <h1 class="text-2xl font-bold text-slate-100 flex items-center gap-3">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-accent"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
        Configurações
      </h1>
      <p class="text-muted mt-2">Ajuste as preferências da sua conta.</p>
    </header>

    <div class="bg-surface-raised border border-surface-border rounded-2xl p-6">
      <h2 class="text-lg font-semibold text-slate-200 mb-4 border-b border-surface-border pb-2">Comprovantes</h2>
      
      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="text-slate-100 font-medium">Exigir comprovantes em transações pagas</p>
          <p class="text-sm text-muted mt-1">Quando ativado, você não poderá marcar uma despesa/receita como "Paga" sem antes anexar um arquivo de comprovante.</p>
        </div>
        <label class="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" v-model="requireReceipts" class="sr-only peer">
          <div class="w-11 h-6 bg-surface-overlay peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent border border-surface-border"></div>
        </label>
      </div>

      <div class="mt-8 pt-4 border-t border-surface-border flex items-center justify-between">
        <span class="text-sm font-medium" :class="message.includes('Erro') ? 'text-red-400' : 'text-emerald-400'">{{ message }}</span>
        <button
          @click="save"
          :disabled="saving"
          class="px-6 py-2 bg-accent hover:bg-accent/90 text-white rounded-xl font-medium transition-colors disabled:opacity-50 shadow-lg shadow-accent/30"
        >
          {{ saving ? 'Salvando...' : 'Salvar Alterações' }}
        </button>
      </div>
    </div>

    <!-- Seção de Contas: congelar saldo -->
    <div class="bg-surface-raised border border-surface-border rounded-2xl p-6 mt-6">
      <h2 class="text-lg font-semibold text-slate-200 mb-1 border-b border-surface-border pb-2">Contas — Saldo</h2>
      <p class="text-sm text-muted mt-2 mb-4">
        <strong>Marcado = afeta o saldo:</strong> a conta entra no saldo total e é alterada pelos pagamentos.
        <strong>Desmarcado = não afeta:</strong> conta histórica/encerrada — fica fora do saldo total e o valor
        congela como referência. Alterações são salvas na hora.
      </p>

      <div v-if="loadingAccounts" class="space-y-2">
        <div v-for="i in 3" :key="i" class="h-12 w-full rounded-xl bg-surface-overlay/40 animate-pulse"></div>
      </div>
      <p v-else-if="accounts.length === 0" class="text-sm text-muted">Nenhuma conta cadastrada.</p>
      <ul v-else class="divide-y divide-surface-border/60">
        <li v-for="a in accounts" :key="a.id" class="flex items-center justify-between gap-4 py-3">
          <div class="flex items-center gap-3 min-w-0">
            <img :src="a.customIconUrl || '/banks/generic.svg'" :alt="a.name" class="h-9 w-9 rounded-lg shrink-0 border border-surface-border object-contain bg-surface-overlay" />
            <div class="min-w-0">
              <p class="text-slate-100 font-medium truncate">{{ a.name }}</p>
              <p class="text-xs tabular-nums" :class="Number(a.currentBalance) < 0 ? 'text-expense' : 'text-muted'">{{ brl(a.currentBalance) }}</p>
            </div>
          </div>
          <div class="flex items-center gap-3 shrink-0">
            <span v-if="a.freezeBalance" class="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/25">Fora do total</span>
            <div v-if="savingAccountId === a.id" class="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin"></div>
            <label class="relative inline-flex items-center cursor-pointer" :title="a.freezeBalance ? 'Não afeta o saldo' : 'Afeta o saldo'">
              <input type="checkbox" :checked="!a.freezeBalance" @change="toggleAffects(a, $event)" class="sr-only peer">
              <div class="w-11 h-6 bg-surface-overlay peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent border border-surface-border"></div>
            </label>
          </div>
        </li>
      </ul>
    </div>

    <!-- Seção de Integração de Calendário -->
    <div class="bg-surface-raised border border-surface-border rounded-2xl p-6 mt-6">
      <h2 class="text-lg font-semibold text-slate-200 mb-4 border-b border-surface-border pb-2">Sincronização com Calendário</h2>
      <div class="flex flex-col gap-4">
        <div>
          <p class="text-slate-100 font-medium">Exportar Próximos Lançamentos (iCal)</p>
          <p class="text-sm text-muted mt-1">Gere um link secreto para adicionar seus lançamentos pendentes no Google Agenda ou Apple Calendar. Eles serão atualizados automaticamente todos os dias.</p>
        </div>
        
        <div v-if="calendarToken" class="mt-2 space-y-3">
          <div class="flex items-center gap-2 bg-surface-overlay/50 border border-surface-border p-3 rounded-xl overflow-hidden">
            <span class="text-xs text-slate-300 truncate flex-1 font-mono select-all">{{ calendarUrl }}</span>
            <button @click="copyCalendarUrl" class="px-3 py-1.5 bg-surface-base hover:bg-surface-border text-xs font-medium text-white rounded-lg transition-colors shrink-0 flex items-center gap-1.5 border border-surface-border">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              Copiar
            </button>
          </div>
          
          <div class="flex items-center gap-3 mt-4">
            <a :href="`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(calendarUrl)}`" target="_blank" class="flex-1 px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-400 rounded-xl font-medium transition-colors text-sm text-center flex justify-center items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
              Google Agenda
            </a>
            <a :href="calendarUrl.replace('https://', 'webcal://').replace('http://', 'webcal://')" class="flex-1 px-4 py-2 bg-surface-overlay hover:bg-surface-border border border-surface-border text-white rounded-xl font-medium transition-colors text-sm text-center flex justify-center items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z"></path><path d="M10 2c1 .5 2 2 2 5"></path></svg>
              Apple Calendar
            </a>
          </div>

          <div class="pt-4 border-t border-surface-border">
            <button @click="generateCalendarToken" :disabled="generatingToken" class="text-xs text-red-400 hover:text-red-300 font-medium disabled:opacity-50 transition-colors">
              Gerar Novo Link (Revoga o anterior)
            </button>
          </div>
        </div>
        
        <div v-else class="mt-2">
          <button @click="generateCalendarToken" :disabled="generatingToken" class="px-5 py-2.5 bg-surface-overlay hover:bg-surface-border border border-surface-border text-white rounded-xl font-medium transition-colors shadow-lg disabled:opacity-50 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-accent"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.59-8.31l-4.28 4.28"/></svg>
            {{ generatingToken ? 'Gerando...' : 'Gerar Link de Sincronização' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Seção de Conta -->
    <div class="bg-surface-raised border border-surface-border rounded-2xl p-6 mt-6">
      <h2 class="text-lg font-semibold text-slate-200 mb-4 border-b border-surface-border pb-2">Conta</h2>
      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="text-slate-100 font-medium">Encerrar sessão</p>
          <p class="text-sm text-muted mt-1">Desconectar do aplicativo neste dispositivo.</p>
        </div>
        <button
          @click="logout"
          class="px-4 py-2 border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-xl font-medium transition-colors"
        >
          Sair da Conta
        </button>
      </div>
    </div>
  </div>
</template>
