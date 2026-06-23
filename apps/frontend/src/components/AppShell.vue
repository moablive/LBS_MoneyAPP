<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { RouterLink, useRouter, useRoute } from 'vue-router';
import { api } from '@moneyapp/api-client';
import type { Account, SubscriptionSummaryResponse, LoanSummaryResponse } from '@moneyapp/models';
import { useAuthStore } from '../stores/auth';
import NewTransactionModal from './modals/NewTransactionModal.vue';
import ChangePasswordModal from './modals/ChangePasswordModal.vue';
import GlobalConfirmDialog from './modals/GlobalConfirmDialog.vue';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();
const showGlobalCreate = ref(false);
const showMore = ref(false);

const LOGO_SRC = '/logo/MONEYAPP.png';
const logoSrc = ref(LOGO_SRC);
let logoRetries = 0;
function retryLogo() {
  if (logoRetries >= 3) return;
  logoRetries += 1;
  setTimeout(() => {
    logoSrc.value = `${LOGO_SRC}?r=${logoRetries}`;
  }, 400 * logoRetries);
}

const nav = [
  { to: '/',           label: 'Dashboard',   icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>' },
  { to: '/transacoes', label: 'Livro Caixa',  icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/></svg>' },
  { to: '/recorrentes', label: 'Mensalidades', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>' },
  {
    label: 'Empréstimos',
    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/></svg>',
    children: [
      { to: '/emprestimos/receber', label: 'A Receber', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-income"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>' },
      { to: '/emprestimos/pagar', label: 'A Pagar', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-expense"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>' },
      { to: '/emprestimos/fgts', label: 'FGTS', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-400"><rect width="20" height="12" x="2" y="6" rx="2"/><path d="M12 12h.01M17 12h.01M7 12h.01"/></svg>' },
      { to: '/emprestimos/pagos', label: 'Pagos', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-green-500"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>' },
    ]
  },
  { to: '/contas',     label: 'Contas',      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a8 8 0 0 1-5.45 7.49 1 1 0 0 1-1.22-1.08L14 16.5a1 1 0 0 0-1-1H7.5a1 1 0 0 0-1 1L5.5 20.41a1 1 0 0 1-1.22 1.08A8 8 0 0 1 2 14v-5"/><path d="M20 12v4M20 16a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2"/></svg>' },
  { to: '/cartoes',    label: 'Cartões',     icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>' },
  { to: '/investimentos', label: 'Investimentos', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>' },
  { to: '/categorias', label: 'Categorias',  icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/></svg>' },
  { to: '/relatorios', label: 'Relatórios',  icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>' },
  { to: '/configuracoes', label: 'Configurações', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>' },
];

const openDropdowns = ref<Record<string, boolean>>({
  'Empréstimos': route.path.startsWith('/emprestimos')
});

function toggleDropdown(label: string) {
  openDropdowns.value[label] = !openDropdowns.value[label];
}

function logout() {
  auth.logout();
  router.push('/login');
}

const accounts = ref<Account[]>([]);
const subscriptionsData = ref<SubscriptionSummaryResponse | null>(null);
const loansData = ref<LoanSummaryResponse | null>(null);

onMounted(async () => {
  try {
    const [accs, subs, lns] = await Promise.all([
      api.get<Account[]>('/accounts'),
      api.get<SubscriptionSummaryResponse>('/subscriptions/summary'),
      api.get<LoanSummaryResponse>('/loans/summary')
    ]);
    accounts.value = accs;
    subscriptionsData.value = subs;
    loansData.value = lns;
  } catch (err) {
    console.error('Failed to load data for app shell', err);
  }
});

const creditCards = computed(() => accounts.value.filter(a => a.type === 'credit_card'));
const checkingAccounts = computed(() => accounts.value.filter(a => a.type !== 'credit_card'));
const brl = (n: number | string) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const totalPaidLoansAmount = computed(() => {
  if (!loansData.value?.items) return 0;
  return loansData.value.items.filter(i => i.status === 'paid').reduce((acc, i) => acc + Number(i.amount), 0);
});

</script>

<template>
  <div class="min-h-dvh flex bg-surface-base">
    <aside class="hidden sm:flex w-64 shrink-0 flex-col bg-surface-raised border-r border-surface-border shadow-xl z-50">
      <div class="px-6 py-6 flex flex-col items-center justify-center border-b border-white/10 mb-4 gap-3">
        <img :src="logoSrc" @error="retryLogo" alt="MoneyAPP" class="h-12 w-auto object-contain" />
        <div class="text-[11px] text-slate-300 truncate max-w-full font-medium tracking-wide bg-surface-overlay px-3 py-1 rounded-full border border-surface-border shadow-inner">
          {{ auth.user?.email }}
        </div>
      </div>
      <nav class="flex-1 px-4 space-y-1">
        <template v-for="item in nav" :key="item.label">
          <!-- Normal Link -->
          <div v-if="!item.children" class="relative group/nav">
            <RouterLink
              :to="item.to!"
              class="nav-link relative flex items-center gap-4 px-4 py-3.5 mx-2 rounded-lg text-[13px] font-semibold uppercase tracking-wider
                     text-muted transition-all duration-300 ease-smooth
                     hover:text-white hover:bg-surface-overlay group-hover/nav:text-white group-hover/nav:bg-surface-overlay"
              active-class="nav-link--active !text-white !bg-accent shadow-lg shadow-accent/30"
            >
              <span v-html="item.icon" class="flex-shrink-0 transition-transform duration-300 group-hover/nav:scale-110"></span>
              {{ item.label }}
            </RouterLink>

            <!-- Hover popup para Cartões -->
            <div 
              v-if="item.label === 'Cartões' && creditCards.length > 0 && route.path !== item.to" 
              class="absolute left-[calc(100%-1rem)] top-0 ml-2 w-64 bg-surface-raised border border-surface-border rounded-xl shadow-2xl opacity-0 invisible group-hover/nav:opacity-100 group-hover/nav:visible transition-all duration-300 z-50 overflow-hidden transform translate-x-[-10px] group-hover/nav:translate-x-0"
            >
              <div class="px-4 py-3 border-b border-surface-border bg-surface-overlay flex justify-between items-center">
                <h3 class="text-[11px] font-bold text-white/90 uppercase tracking-widest flex items-center gap-2">
                  <span v-html="item.icon" class="w-4 h-4 text-accent"></span>
                  Faturas Atuais
                </h3>
                <span class="text-xs font-bold text-expense">{{ brl(creditCards.reduce((acc, card) => acc + Math.abs(Number(card.currentBalance)), 0)) }}</span>
              </div>
              <ul class="p-2 space-y-1">
                <li v-for="card in creditCards" :key="card.id" class="p-2.5 rounded-lg hover:bg-surface-overlay/80 transition-colors cursor-pointer" @click="router.push('/cartoes')">
                  <div class="flex justify-between items-center mb-1.5">
                    <div class="flex items-center gap-2 overflow-hidden">
                      <img v-if="card.customIconUrl" :src="card.customIconUrl" class="w-4 h-4 rounded-sm object-contain" />
                      <span class="text-xs font-semibold text-white/90 truncate">{{ card.name }}</span>
                    </div>
                    <span class="text-xs font-bold font-display text-expense">{{ brl(Math.abs(Number(card.currentBalance))) }}</span>
                  </div>
                  <div class="h-1 rounded-full bg-surface-base overflow-hidden" v-if="card.creditLimit && Number(card.creditLimit) > 0">
                    <div class="h-full bg-expense" :style="{ width: `${Math.min(100, Math.max(0, (Math.abs(Number(card.currentBalance)) / Number(card.creditLimit)) * 100))}%` }" />
                  </div>
                </li>
              </ul>
            </div>

            <!-- Hover popup para Contas -->
            <div 
              v-if="item.label === 'Contas' && checkingAccounts.length > 0 && route.path !== item.to" 
              class="absolute left-[calc(100%-1rem)] top-0 ml-2 w-64 bg-surface-raised border border-surface-border rounded-xl shadow-2xl opacity-0 invisible group-hover/nav:opacity-100 group-hover/nav:visible transition-all duration-300 z-50 overflow-hidden transform translate-x-[-10px] group-hover/nav:translate-x-0"
            >
              <div class="px-4 py-3 border-b border-surface-border bg-surface-overlay flex justify-between items-center">
                <h3 class="text-[11px] font-bold text-white/90 uppercase tracking-widest flex items-center gap-2">
                  <span v-html="item.icon" class="w-4 h-4 text-accent"></span>
                  Saldos Atuais
                </h3>
                <span class="text-xs font-bold font-display" :class="checkingAccounts.reduce((acc, a) => acc + Number(a.currentBalance), 0) >= 0 ? 'text-income' : 'text-expense'">
                  {{ brl(checkingAccounts.reduce((acc, a) => acc + Number(a.currentBalance), 0)) }}
                </span>
              </div>
              <ul class="p-2 space-y-1">
                <li v-for="acc in checkingAccounts" :key="acc.id" class="p-2.5 rounded-lg hover:bg-surface-overlay/80 transition-colors cursor-pointer" @click="router.push('/contas')">
                  <div class="flex justify-between items-center">
                    <div class="flex items-center gap-2 overflow-hidden">
                      <img v-if="acc.customIconUrl" :src="acc.customIconUrl" class="w-4 h-4 rounded-sm object-contain" />
                      <span class="text-xs font-semibold text-white/90 truncate">{{ acc.name }}</span>
                    </div>
                    <span class="text-xs font-bold font-display" :class="Number(acc.currentBalance) >= 0 ? 'text-income' : 'text-expense'">{{ brl(Number(acc.currentBalance)) }}</span>
                  </div>
                </li>
              </ul>
            </div>

            <!-- Hover popup para Mensalidades -->
            <div 
              v-if="item.label === 'Mensalidades' && subscriptionsData?.items?.length && route.path !== item.to" 
              class="absolute left-[calc(100%-1rem)] top-0 ml-2 w-64 bg-surface-raised border border-surface-border rounded-xl shadow-2xl opacity-0 invisible group-hover/nav:opacity-100 group-hover/nav:visible transition-all duration-300 z-50 overflow-hidden transform translate-x-[-10px] group-hover/nav:translate-x-0"
            >
              <div class="px-4 py-3 border-b border-surface-border bg-surface-overlay flex justify-between items-center">
                <h3 class="text-[11px] font-bold text-white/90 uppercase tracking-widest flex items-center gap-2">
                  <span v-html="item.icon" class="w-4 h-4 text-accent"></span>
                  Mensalidades
                </h3>
                <span class="text-xs font-bold text-expense">{{ brl(subscriptionsData.gastoMensal) }}</span>
              </div>
              <ul class="p-2 space-y-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                <li v-for="sub in subscriptionsData.items.filter(i => i.status === 'active')" :key="sub.id" class="p-2.5 rounded-lg hover:bg-surface-overlay/80 transition-colors cursor-pointer" @click="router.push('/recorrentes')">
                  <div class="flex justify-between items-center">
                    <div class="flex flex-col overflow-hidden max-w-[120px]">
                      <span class="text-xs font-semibold text-white/90 truncate">{{ sub.description }}</span>
                      <span class="text-[10px] text-muted">Dia {{ sub.billingDay }}</span>
                    </div>
                    <span class="text-xs font-bold font-display" :class="sub.type === 'income' ? 'text-income' : 'text-expense'">{{ brl(sub.amount) }}</span>
                  </div>
                </li>
              </ul>
            </div>
          </div>

          <!-- Dropdown -->
          <div v-else class="flex flex-col relative group/nav">
            <button
              @click="toggleDropdown(item.label)"
              class="nav-link group relative flex items-center justify-between gap-4 px-4 py-3.5 mx-2 rounded-lg text-[13px] font-semibold uppercase tracking-wider text-muted transition-all duration-300 ease-smooth hover:text-white hover:bg-surface-overlay w-[calc(100%-1rem)]"
              :class="{ '!text-white !bg-accent/10': item.children.some(child => route.path === child.to) }"
            >
              <div class="flex items-center gap-4">
                <span v-html="item.icon" class="flex-shrink-0 transition-transform duration-300 group-hover:scale-110"></span>
                {{ item.label }}
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="transition-transform duration-300" :class="{ 'rotate-180': openDropdowns[item.label] }">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>

            <!-- Dropdown content -->
            <div
              v-show="openDropdowns[item.label]"
              class="flex flex-col gap-1 mt-1 pl-4 overflow-hidden"
            >
              <RouterLink
                v-for="child in item.children"
                :key="child.to"
                :to="child.to"
                class="nav-link group relative flex items-center gap-4 px-4 py-2.5 mx-2 rounded-lg text-[12px] font-semibold uppercase tracking-wider
                       text-muted transition-all duration-300 ease-smooth
                       hover:text-white hover:bg-surface-overlay"
                active-class="nav-link--active !text-white !bg-accent shadow-lg shadow-accent/30"
              >
                <span v-html="child.icon" class="flex-shrink-0 transition-transform duration-300 group-hover:scale-110"></span>
                {{ child.label }}
              </RouterLink>
            </div>

            <!-- Hover popup para Empréstimos -->
            <div 
              v-if="item.label === 'Empréstimos' && loansData?.items?.length && !item.children.some(child => route.path === child.to)" 
              class="absolute left-[calc(100%-1rem)] top-0 ml-2 w-64 bg-surface-raised border border-surface-border rounded-xl shadow-2xl opacity-0 invisible group-hover/nav:opacity-100 group-hover/nav:visible transition-all duration-300 z-50 overflow-hidden transform translate-x-[-10px] group-hover/nav:translate-x-0"
            >
              <div class="px-4 py-3 border-b border-surface-border bg-surface-overlay flex flex-col gap-1">
                <h3 class="text-[11px] font-bold text-white/90 uppercase tracking-widest flex items-center gap-2 mb-1">
                  <span v-html="item.icon" class="w-4 h-4 text-accent"></span>
                  Empréstimos Ativos
                </h3>
                <div class="flex justify-between text-[10px] font-bold uppercase">
                  <span class="text-expense">A Pagar: {{ brl(loansData.totalActiveAmountReceived) }}</span>
                  <span class="text-income">A Receber: {{ brl(loansData.totalActiveAmountGiven) }}</span>
                </div>
                <div class="flex justify-between text-[10px] font-bold uppercase mt-1 pt-1 border-t border-surface-border">
                  <span class="text-muted">Já Pagos:</span>
                  <span class="text-green-500">{{ brl(totalPaidLoansAmount) }}</span>
                </div>
              </div>
              <ul class="p-2 space-y-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                <li v-for="loan in loansData.items.filter(i => i.status === 'active')" :key="loan.id" class="p-2.5 rounded-lg hover:bg-surface-overlay/80 transition-colors cursor-pointer" @click="router.push(loan.type === 'received' ? '/emprestimos/pagar' : '/emprestimos/receber')">
                  <div class="flex justify-between items-center">
                    <div class="flex flex-col overflow-hidden max-w-[120px]">
                      <span class="text-xs font-semibold text-white/90 truncate">{{ loan.description }}</span>
                    </div>
                    <span class="text-xs font-bold font-display" :class="loan.type === 'given' ? 'text-income' : 'text-expense'">{{ brl(loan.amount) }}</span>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </template>
      </nav>
      <div class="m-4">
        <button
          class="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm text-white/70 bg-surface-overlay border border-surface-border hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition-all shadow-sm"
          @click="logout"
          title="Sair"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
          <span class="font-medium tracking-wide">Sair</span>
        </button>
      </div>
    </aside>

    <main class="flex-1 min-w-0 pb-20 sm:pb-0">
      <slot />
    </main>

    <!-- Mobile Bottom Navigation -->
    <nav class="sm:hidden fixed bottom-0 left-0 right-0 bg-surface-raised border-t border-surface-border flex items-center justify-around px-2 py-2 z-50">
      <RouterLink to="/" class="p-2 flex flex-col items-center gap-1 text-muted transition-colors" active-class="text-accent !text-accent">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
        <span class="text-[10px] font-medium">Início</span>
      </RouterLink>
      
      <RouterLink to="/transacoes" class="p-2 flex flex-col items-center gap-1 text-muted transition-colors" active-class="text-accent !text-accent">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/></svg>
        <span class="text-[10px] font-medium">Caixa</span>
      </RouterLink>
      
      <!-- Central FAB -->
      <div class="relative -top-6">
        <button 
          @click="showGlobalCreate = true" 
          class="flex items-center justify-center w-14 h-14 bg-accent text-white rounded-full shadow-lg shadow-accent/30 hover:scale-105 transition-transform"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </button>
      </div>

      <RouterLink to="/contas" class="p-2 flex flex-col items-center gap-1 text-muted transition-colors" active-class="text-accent !text-accent">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a8 8 0 0 1-5.45 7.49 1 1 0 0 1-1.22-1.08L14 16.5a1 1 0 0 0-1-1H7.5a1 1 0 0 0-1 1L5.5 20.41a1 1 0 0 1-1.22 1.08A8 8 0 0 1 2 14v-5"/><path d="M20 12v4M20 16a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2"/></svg>
        <span class="text-[10px] font-medium">Contas</span>
      </RouterLink>

      <!-- "Mais" opens a bottom sheet with the remaining sections -->
      <button
        @click="showMore = true"
        class="p-2 flex flex-col items-center gap-1 text-muted transition-colors hover:text-accent"
        :class="{ 'text-accent': showMore }"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" x2="21" y1="6" y2="6"/><line x1="3" x2="21" y1="12" y2="12"/><line x1="3" x2="21" y1="18" y2="18"/></svg>
        <span class="text-[10px] font-medium">Mais</span>
      </button>
    </nav>

    <!-- Mobile "Mais" bottom sheet -->
    <div v-if="showMore" class="sm:hidden fixed inset-0 z-[60]" @click="showMore = false">
      <div class="absolute inset-0 bg-black/60"></div>
      <div
        class="absolute bottom-0 left-0 right-0 max-h-[80vh] overflow-y-auto bg-surface-raised border-t border-surface-border rounded-t-2xl shadow-2xl pb-[env(safe-area-inset-bottom)]"
        @click.stop
      >
        <div class="flex justify-center pt-3 pb-1">
          <div class="h-1 w-10 rounded-full bg-surface-border"></div>
        </div>
        <div class="px-4 py-2 flex items-center justify-between border-b border-surface-border">
          <span class="text-xs font-semibold uppercase tracking-wider text-muted">Menu</span>
          <button @click="showMore = false" class="text-muted hover:text-white p-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <nav class="p-3 space-y-1">
          <template v-for="item in nav" :key="item.label">
            <RouterLink
              v-if="!item.children"
              :to="item.to!"
              @click="showMore = false"
              class="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-muted transition-colors hover:bg-surface-overlay hover:text-white"
              active-class="!text-white !bg-accent"
            >
              <span v-html="item.icon" class="flex-shrink-0"></span>
              {{ item.label }}
            </RouterLink>

            <div v-else>
              <div class="flex items-center gap-3 px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted/70">
                <span v-html="item.icon" class="flex-shrink-0 opacity-70"></span>
                {{ item.label }}
              </div>
              <RouterLink
                v-for="child in item.children"
                :key="child.to"
                :to="child.to"
                @click="showMore = false"
                class="flex items-center gap-3 pl-9 pr-3 py-2.5 rounded-xl text-sm font-medium text-muted transition-colors hover:bg-surface-overlay hover:text-white"
                active-class="!text-white !bg-accent"
              >
                <span v-html="child.icon" class="flex-shrink-0"></span>
                {{ child.label }}
              </RouterLink>
            </div>
          </template>

          <button
            @click="logout"
            class="w-full mt-2 flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-red-400 bg-surface-overlay border border-surface-border hover:bg-red-500/10 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
            Sair
          </button>
        </nav>
      </div>
    </div>

    <NewTransactionModal 
      :open="showGlobalCreate" 
      @close="showGlobalCreate = false" 
    />
    <ChangePasswordModal />
    <GlobalConfirmDialog />
  </div>
</template>
