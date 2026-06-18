<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import { sharesClient } from '@moneyapp/api-client';
import type { Transaction } from '@moneyapp/models';
import { BuildingLibraryIcon as Landmark, LockClosedIcon as Lock, PaperClipIcon as Paperclip, XMarkIcon as XMark } from '@heroicons/vue/24/outline';

const route = useRoute();
const token = route.params.token as string;

const password = ref('');
const sessionToken = ref('');
const errorMsg = ref('');
const loading = ref(false);
const selectedReceipt = ref<{ url: string, type: string } | null>(null);

const transactions = ref<Transaction[]>([]);
const isAuthenticated = ref(false);

async function authenticate() {
  if (!password.value) return;
  loading.value = true;
  errorMsg.value = '';
  try {
    const res = await sharesClient.verifyShareLink(token, password.value);
    sessionToken.value = res.token;
    isAuthenticated.value = true;
    await loadTransactions();
  } catch (err: any) {
    if (err.status === 401) {
      errorMsg.value = 'Senha incorreta.';
    } else if (err.status === 404) {
      errorMsg.value = 'Link não encontrado ou expirado.';
    } else {
      errorMsg.value = 'Erro ao verificar senha.';
    }
  } finally {
    loading.value = false;
  }
}

async function loadTransactions() {
  loading.value = true;
  try {
    transactions.value = await sharesClient.getSharedTransactions(token, sessionToken.value);
  } catch (err) {
    errorMsg.value = 'Erro ao carregar transações.';
  } finally {
    loading.value = false;
  }
}

async function viewReceipt(t: Transaction) {
  if (!t.hasReceipt) return;
  try {
    const data = await sharesClient.getSharedTransactionReceipt(token, t.id, sessionToken.value);
    selectedReceipt.value = data;
  } catch (err) {
    window.alert('Erro ao carregar comprovante.');
  }
}

function closeReceipt() {
  if (selectedReceipt.value) {
    URL.revokeObjectURL(selectedReceipt.value.url);
    selectedReceipt.value = null;
  }
}

const grouped = computed(() => {
  const map = new Map<string, Transaction[]>();
  for (const r of transactions.value) {
    const day = r.occurredAt.slice(0, 10);
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(r);
  }
  return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
});

const brl = (n: number | string) =>
  Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatDay = (iso: string) => {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  const day = String(d.getUTCDate()).padStart(2, '0');
  const monthNum = String(d.getUTCMonth() + 1).padStart(2, '0');
  let monthName = d.toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' });
  monthName = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  return `${day}/${monthNum} - ${monthName}`;
};

const formatTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

</script>

<template>
  <div class="min-h-screen bg-surface-base text-white font-sans antialiased overflow-y-auto w-full relative h-full flex flex-col">
    <!-- Auth Screen -->
    <div v-if="!isAuthenticated" class="flex-1 flex flex-col items-center justify-center p-4">
      <div class="w-full max-w-sm bg-surface-raised border border-surface-border rounded-2xl p-6 shadow-xl text-center">
        <Lock class="w-12 h-12 text-accent mx-auto mb-4" />
        <h2 class="text-xl font-bold mb-2">Acesso Protegido</h2>
        <p class="text-sm text-muted mb-6">Este extrato é protegido por senha. Insira a senha para visualizar.</p>
        
        <form @submit.prevent="authenticate" class="space-y-4">
          <div>
            <input 
              type="password" 
              v-model="password" 
              placeholder="Digite a senha" 
              class="w-full bg-surface-overlay border border-surface-border rounded-xl px-4 py-3 text-white placeholder-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent"
              required
            />
          </div>
          <div v-if="errorMsg" class="text-expense text-sm font-medium">{{ errorMsg }}</div>
          <button 
            type="submit" 
            :disabled="loading"
            class="w-full bg-accent text-white rounded-xl py-3 font-bold shadow-lg hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            {{ loading ? 'Acessando...' : 'Acessar Extrato' }}
          </button>
        </form>
      </div>
    </div>

    <!-- Data Screen -->
    <div v-else class="flex-1 mx-auto max-w-4xl px-4 py-8 space-y-6 w-full">
      <header class="flex items-center justify-between border-b border-surface-border pb-6 mb-8">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-white">Extrato Compartilhado</h1>
          <p class="text-sm text-muted mt-1">Visão somente leitura (24 horas de validade)</p>
        </div>
      </header>

      <section v-if="loading" class="space-y-4">
        <div v-for="i in 6" :key="i" class="skeleton h-20 w-full rounded-2xl" />
      </section>

      <section v-else class="space-y-8">
        <div v-if="transactions.length === 0" class="py-16 flex flex-col items-center justify-center text-center bg-surface-raised border border-surface-border rounded-2xl">
          <Landmark class="w-12 h-12 text-muted/50 mb-4" />
          <p class="text-muted font-medium">Nenhuma transação encontrada.</p>
        </div>

        <div v-for="[day, list] in grouped" :key="day" class="bg-surface-raised border border-surface-border rounded-xl overflow-hidden shadow-sm">
          <div class="flex justify-between items-center bg-surface-overlay/30 px-4 py-2 border-b border-surface-border">
            <span class="text-xs font-semibold text-muted capitalize">{{ formatDay(day) }}</span>
            <span class="tabular-nums font-bold text-xs text-muted">
              {{ brl(list.reduce((acc, r) => acc + Number(r.amount), 0)) }}
            </span>
          </div>
          <ul class="divide-y divide-surface-border/30">
            <li
              v-for="r in list"
              :key="r.id"
              class="px-4 py-3 grid grid-cols-[1fr_auto] items-center gap-4 transition-colors hover:bg-surface-overlay/30"
            >
              <div class="flex items-center justify-start gap-3 min-w-0">
                <div v-if="(r as any).account" 
                     class="flex items-center justify-center w-8 h-8 rounded-lg bg-surface-base border border-surface-border text-white/80 shrink-0">
                  <img v-if="(r as any).account?.customIconUrl" :src="(r as any).account.customIconUrl" class="w-5 h-5 rounded-md object-contain" />
                  <Landmark v-else class="w-4 h-4 text-accent" />
                </div>
                <div v-else class="flex items-center justify-center w-8 h-8 rounded-lg bg-surface-base border border-surface-border text-muted shrink-0">
                  <Landmark class="w-4 h-4" />
                </div>
                
                <div class="flex flex-col min-w-0">
                  <span class="font-medium text-sm text-white/90 truncate">{{ r.description }}</span>
                  <div class="flex items-center gap-2 mt-1">
                    <span class="text-xs text-muted">{{ formatTime(r.occurredAt) }}</span>
                    <div v-if="(r as any).category" class="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-surface-overlay border border-surface-border">
                      <div class="w-1.5 h-1.5 rounded-full shrink-0" :style="{ backgroundColor: (r as any).category.color || '#666' }"></div>
                      <span class="text-[10px] uppercase font-semibold text-muted tracking-wide truncate">{{ (r as any).category.name }}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div class="flex items-center justify-end gap-3 min-w-0 shrink-0">
                <button 
                  v-if="r.hasReceipt"
                  @click="viewReceipt(r as any)"
                  class="flex items-center justify-center p-1.5 rounded-lg bg-surface-base border border-surface-border text-white/50 hover:text-white hover:bg-surface-overlay transition-colors"
                  title="Ver Comprovante"
                >
                  <Paperclip class="w-4 h-4" />
                </button>
                <div
                  class="tabular-nums font-semibold text-sm text-right"
                  :class="r.type === 'expense' ? 'text-expense' : 'text-income'"
                >
                  {{ r.type === 'expense' && !r.amount.toString().startsWith('-') ? '-' : '' }}{{ brl(r.amount) }}
                </div>
              </div>
            </li>
          </ul>
        </div>
      </section>
    </div>

    <!-- Receipt Modal -->
    <div v-if="selectedReceipt" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="closeReceipt"></div>
      <div class="relative w-full max-w-3xl bg-surface-raised rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] z-10">
        <div class="flex items-center justify-between p-4 border-b border-surface-border">
          <h3 class="font-bold text-white">Comprovante</h3>
          <button @click="closeReceipt" class="p-1 rounded-lg text-muted hover:text-white hover:bg-surface-overlay transition-colors">
            <XMark class="w-6 h-6" />
          </button>
        </div>
        <div class="flex-1 overflow-auto bg-surface-base p-4 flex items-center justify-center">
          <img 
            v-if="selectedReceipt.type.startsWith('image/')" 
            :src="selectedReceipt.url" 
            class="max-w-full max-h-full object-contain rounded-lg"
          />
          <iframe 
            v-else 
            :src="selectedReceipt.url" 
            class="w-full h-[70vh] rounded-lg border-0 bg-white"
          ></iframe>
        </div>
      </div>
    </div>
  </div>
</template>
