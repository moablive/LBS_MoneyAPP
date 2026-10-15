<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { RouterLink, useRouter, useRoute } from 'vue-router';
import { api } from '@moneyapp/api-client';
import type { Account, SubscriptionSummaryResponse, LoanSummaryResponse } from '@moneyapp/models';
import { useAuthStore } from '../stores/auth';
import { useTheme } from '../composables/useTheme';
import NewTransactionModal from './modals/NewTransactionModal.vue';
import GlobalConfirmDialog from './modals/GlobalConfirmDialog.vue';
import CsvImportModal from './modals/CsvImportModal.vue';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();
const showGlobalCreate = ref(false);
const showMore = ref(false);
const showCsvImport = ref(false);
const { theme, toggle: toggleTheme } = useTheme();

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

type NavChild = { to: string; label: string; icon: string };
type NavItem = { to?: string; label: string; icon: string; children?: NavChild[] };

const nav: NavItem[] = [
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
  { to: '/empresas',   label: 'Empresas',    icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>' },
  { to: '/cartoes',    label: 'Cartões',     icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>' },
  { to: '/investimentos', label: 'Investimentos', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>' },
  { to: '/categorias', label: 'Categorias',  icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/></svg>' },
  { to: '/relatorios', label: 'Relatórios',  icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>' },
  { to: '/configuracoes', label: 'Configurações', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>' },
];

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

/** Ativo por prefixo: '/' só quando é exatamente a home; grupo (Empréstimos)
 *  quando qualquer filho casa. */
function isActive(item: NavItem): boolean {
  if (item.children) return item.children.some(c => route.path === c.to);
  if (item.to === '/') return route.path === '/';
  return route.path === item.to || (!!item.to && route.path.startsWith(item.to + '/'));
}
/** Itens cujo popup já mostra dados; os outros ganham só a etiqueta. */
function hasPopup(item: NavItem): boolean {
  if (item.label === 'Cartões') return creditCards.value.length > 0;
  if (item.label === 'Contas') return checkingAccounts.value.length > 0;
  if (item.label === 'Mensalidades') return !!subscriptionsData.value?.items?.length;
  if (item.label === 'Empréstimos') return true;
  return false;
}
const avatarInitial = computed(() => (auth.user?.email?.[0] || '?').toUpperCase());

const totalPaidLoansAmount = computed(() => {
  if (!loansData.value?.items) return 0;
  return loansData.value.items.filter(i => i.status === 'paid').reduce((acc, i) => acc + Number(i.amount), 0);
});

</script>
<template>
  <div class="min-h-dvh bg-surface-base">
    <!-- ───────── Rail (desktop): pílula escura flutuante, só ícones ───────── -->
    <aside
      class="hidden sm:flex fixed left-4 top-4 bottom-4 w-[76px] z-50 flex-col items-center
             rounded-[28px] bg-ink-950 text-white/60 py-4 shadow-rail"
    >
      <RouterLink to="/" class="relative group/nav flex items-center justify-center w-12 h-12 rounded-2xl hover:bg-white/10 transition-colors" title="MoneyAPP">
        <img :src="logoSrc" @error="retryLogo" alt="MoneyAPP" class="h-10 w-10 object-contain drop-shadow" />
      </RouterLink>

      <nav class="flex-1 flex flex-col items-center gap-1.5 mt-4 w-full px-3">
        <div v-for="item in nav" :key="item.label" class="relative group/nav">
          <RouterLink
            :to="item.to ?? item.children?.[0]?.to ?? '/'"
            class="rail-btn"
            :class="{ 'rail-btn--active': isActive(item) }"
            :aria-label="item.label"
          >
            <span v-html="item.icon" class="flex-shrink-0 transition-transform duration-300 group-hover/nav:scale-110"></span>
          </RouterLink>

          <!-- Etiqueta simples -->
          <div v-if="!hasPopup(item)" class="rail-tip">{{ item.label }}</div>

          <!-- Popup: Cartões -->
          <div v-else-if="item.label === 'Cartões'" class="rail-pop-wrap">
            <div class="rail-pop">
              <div class="rail-pop-head">
                <span class="rail-pop-title"><span v-html="item.icon" class="w-4 h-4 text-fg"></span> Faturas atuais</span>
                <span class="text-xs font-bold text-expense font-display">{{ brl(creditCards.reduce((acc, card) => acc + Math.abs(Number(card.currentBalance)), 0)) }}</span>
              </div>
              <ul class="p-2 space-y-0.5">
                <li v-for="card in creditCards" :key="card.id" class="rail-pop-row" @click="router.push('/cartoes')">
                  <div class="flex justify-between items-center mb-1.5">
                    <div class="flex items-center gap-2 overflow-hidden">
                      <img v-if="card.customIconUrl" :src="card.customIconUrl" class="w-4 h-4 rounded-sm object-contain" />
                      <span class="text-xs font-semibold text-fg truncate">{{ card.name }}</span>
                    </div>
                    <span class="text-xs font-bold font-display text-expense">{{ brl(Math.abs(Number(card.currentBalance))) }}</span>
                  </div>
                  <div class="h-1 rounded-full bg-surface-overlay overflow-hidden" v-if="card.creditLimit && Number(card.creditLimit) > 0">
                    <div class="h-full bg-expense" :style="{ width: `${Math.min(100, Math.max(0, (Math.abs(Number(card.currentBalance)) / Number(card.creditLimit)) * 100))}%` }" />
                  </div>
                </li>
              </ul>
            </div>
          </div>

          <!-- Popup: Contas -->
          <div v-else-if="item.label === 'Contas'" class="rail-pop-wrap">
            <div class="rail-pop">
              <div class="rail-pop-head">
                <span class="rail-pop-title"><span v-html="item.icon" class="w-4 h-4 text-fg"></span> Saldos atuais</span>
                <span class="text-xs font-bold font-display" :class="checkingAccounts.reduce((acc, a) => acc + Number(a.currentBalance), 0) >= 0 ? 'text-income' : 'text-expense'">
                  {{ brl(checkingAccounts.reduce((acc, a) => acc + Number(a.currentBalance), 0)) }}
                </span>
              </div>
              <ul class="p-2 space-y-0.5">
                <li v-for="acc in checkingAccounts" :key="acc.id" class="rail-pop-row" @click="router.push('/contas')">
                  <div class="flex justify-between items-center">
                    <div class="flex items-center gap-2 overflow-hidden">
                      <img v-if="acc.customIconUrl" :src="acc.customIconUrl" class="w-4 h-4 rounded-sm object-contain" />
                      <span class="text-xs font-semibold text-fg truncate">{{ acc.name }}</span>
                    </div>
                    <span class="text-xs font-bold font-display" :class="Number(acc.currentBalance) >= 0 ? 'text-fg' : 'text-expense'">{{ brl(Number(acc.currentBalance)) }}</span>
                  </div>
                </li>
              </ul>
            </div>
          </div>

          <!-- Popup: Mensalidades -->
          <div v-else-if="item.label === 'Mensalidades'" class="rail-pop-wrap">
            <div class="rail-pop">
              <div class="rail-pop-head">
                <span class="rail-pop-title"><span v-html="item.icon" class="w-4 h-4 text-fg"></span> Mensalidades</span>
                <span class="text-xs font-bold text-expense font-display">{{ brl(subscriptionsData!.gastoMensal) }}</span>
              </div>
              <ul class="p-2 space-y-0.5 max-h-[300px] overflow-y-auto custom-scrollbar">
                <li v-for="sub in subscriptionsData!.items.filter(i => i.status === 'active')" :key="sub.id" class="rail-pop-row" @click="router.push('/recorrentes')">
                  <div class="flex justify-between items-center">
                    <div class="flex flex-col overflow-hidden max-w-[140px]">
                      <span class="text-xs font-semibold text-fg truncate">{{ sub.description }}</span>
                      <span class="text-[10px] text-muted">Dia {{ sub.billingDay }}</span>
                    </div>
                    <span class="text-xs font-bold font-display" :class="sub.type === 'income' ? 'text-income' : 'text-expense'">{{ brl(sub.amount) }}</span>
                  </div>
                </li>
              </ul>
            </div>
          </div>

          <!-- Popup: Empréstimos (sub-rotas + resumo) -->
          <div v-else-if="item.label === 'Empréstimos'" class="rail-pop-wrap">
            <div class="rail-pop">
              <div class="rail-pop-head flex-col !items-start gap-2">
                <span class="rail-pop-title"><span v-html="item.icon" class="w-4 h-4 text-fg"></span> Empréstimos</span>
                <div class="grid grid-cols-2 gap-1 w-full">
                  <RouterLink
                    v-for="child in item.children"
                    :key="child.to"
                    :to="child.to"
                    class="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-fg/80 hover:bg-surface-overlay hover:text-fg transition-colors"
                    active-class="!bg-accent !text-white"
                  >
                    <span v-html="child.icon" class="[&>svg]:w-3.5 [&>svg]:h-3.5"></span>
                    {{ child.label }}
                  </RouterLink>
                </div>
              </div>
              <div v-if="loansData" class="px-4 py-2.5 border-b border-surface-border text-[10px] font-bold uppercase tracking-wide space-y-1">
                <div class="flex justify-between"><span class="text-expense">A pagar</span><span class="text-expense">{{ brl(loansData.totalActiveAmountReceived) }}</span></div>
                <div class="flex justify-between"><span class="text-income">A receber</span><span class="text-income">{{ brl(loansData.totalActiveAmountGiven) }}</span></div>
                <div class="flex justify-between pt-1 border-t border-surface-border"><span class="text-muted">Já pagos</span><span class="text-fg">{{ brl(totalPaidLoansAmount) }}</span></div>
              </div>
              <ul v-if="loansData?.items?.length" class="p-2 space-y-0.5 max-h-[220px] overflow-y-auto custom-scrollbar">
                <li v-for="loan in loansData.items.filter(i => i.status === 'active')" :key="loan.id" class="rail-pop-row" @click="router.push(loan.type === 'received' ? '/emprestimos/pagar' : '/emprestimos/receber')">
                  <div class="flex justify-between items-center gap-2">
                    <span class="text-xs font-semibold text-fg truncate">{{ loan.description }}</span>
                    <span class="text-xs font-bold font-display shrink-0" :class="loan.type === 'given' ? 'text-income' : 'text-expense'">{{ brl(loan.amount) }}</span>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </nav>

      <!-- Rodapé do rail -->
      <div class="flex flex-col items-center gap-1.5 w-full px-3 pt-3 border-t border-white/10">
        <div class="relative group/nav">
          <button class="rail-btn" @click="showCsvImport = true" aria-label="Importar CSV">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
          </button>
          <div class="rail-tip">Importar CSV</div>
        </div>
        <div class="relative group/nav">
          <button class="rail-btn" @click="toggleTheme" :aria-label="theme === 'dark' ? 'Tema claro' : 'Tema escuro'">
            <svg v-if="theme === 'dark'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
          </button>
          <div class="rail-tip">{{ theme === 'dark' ? 'Tema claro' : 'Tema escuro' }}</div>
        </div>
        <div class="relative group/nav">
          <button class="rail-btn hover:!text-red-400 hover:!bg-red-500/10" @click="logout" aria-label="Sair">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
          </button>
          <div class="rail-tip">Sair</div>
        </div>
        <div class="relative group/nav mt-1">
          <RouterLink to="/configuracoes" class="flex items-center justify-center w-10 h-10 rounded-full bg-lime text-lime-fg font-display font-bold text-sm shadow-lg shadow-lime/30 hover:scale-105 transition-transform" aria-label="Configurações">
            {{ avatarInitial }}
          </RouterLink>
          <div class="rail-tip">{{ auth.user?.email }} · Configurações</div>
        </div>
      </div>
    </aside>

    <main class="min-w-0 pb-28 sm:pb-0 sm:pl-[108px]">
      <slot />
    </main>

    <!-- ───────── Navegação mobile: pílula escura flutuante ───────── -->
    <nav class="sm:hidden fixed bottom-3 left-3 right-3 z-50 rounded-[26px] bg-ink-950 text-white/60 flex items-center justify-around px-2 py-2 shadow-rail">
      <RouterLink to="/" class="p-2 flex flex-col items-center gap-1 transition-colors" active-class="!text-lime" :class="{ '!text-lime': route.path === '/' }">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
        <span class="text-[10px] font-medium">Início</span>
      </RouterLink>

      <RouterLink to="/transacoes" class="p-2 flex flex-col items-center gap-1 transition-colors" active-class="!text-lime">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/></svg>
        <span class="text-[10px] font-medium">Caixa</span>
      </RouterLink>

      <!-- FAB central -->
      <div class="relative -top-7">
        <button
          @click="showGlobalCreate = true"
          class="flex items-center justify-center w-14 h-14 bg-lime text-lime-fg rounded-full shadow-lg shadow-lime/40 ring-4 ring-surface-base hover:scale-105 transition-transform"
          aria-label="Novo lançamento"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </button>
      </div>

      <RouterLink to="/contas" class="p-2 flex flex-col items-center gap-1 transition-colors" active-class="!text-lime">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a8 8 0 0 1-5.45 7.49 1 1 0 0 1-1.22-1.08L14 16.5a1 1 0 0 0-1-1H7.5a1 1 0 0 0-1 1L5.5 20.41a1 1 0 0 1-1.22 1.08A8 8 0 0 1 2 14v-5"/><path d="M20 12v4M20 16a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2"/></svg>
        <span class="text-[10px] font-medium">Contas</span>
      </RouterLink>

      <button
        @click="showMore = true"
        class="p-2 flex flex-col items-center gap-1 transition-colors"
        :class="{ 'text-lime': showMore }"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" x2="21" y1="6" y2="6"/><line x1="3" x2="21" y1="12" y2="12"/><line x1="3" x2="21" y1="18" y2="18"/></svg>
        <span class="text-[10px] font-medium">Mais</span>
      </button>
    </nav>

    <!-- Folha "Mais" (mobile) -->
    <div v-if="showMore" class="sm:hidden fixed inset-0 z-[60]" @click="showMore = false">
      <div class="absolute inset-0 bg-ink-950/40 backdrop-blur-sm"></div>
      <div
        class="absolute bottom-0 left-0 right-0 max-h-[80vh] overflow-y-auto bg-surface-raised border-t border-surface-border rounded-t-3xl shadow-modal pb-[env(safe-area-inset-bottom)]"
        @click.stop
      >
        <div class="flex justify-center pt-3 pb-1">
          <div class="h-1 w-10 rounded-full bg-surface-border"></div>
        </div>
        <div class="px-4 py-2 flex items-center justify-between border-b border-surface-border">
          <div class="flex items-center gap-3 min-w-0">
            <div class="flex items-center justify-center w-8 h-8 rounded-full bg-lime text-lime-fg font-display font-bold text-xs shrink-0">{{ avatarInitial }}</div>
            <span class="text-xs text-muted truncate">{{ auth.user?.email }}</span>
          </div>
          <button @click="showMore = false" class="text-muted hover:text-fg p-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <nav class="p-3 space-y-1">
          <template v-for="item in nav" :key="item.label">
            <RouterLink
              v-if="!item.children"
              :to="item.to!"
              @click="showMore = false"
              class="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-muted transition-colors hover:bg-surface-overlay hover:text-fg"
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
                class="flex items-center gap-3 pl-9 pr-3 py-2.5 rounded-xl text-sm font-medium text-muted transition-colors hover:bg-surface-overlay hover:text-fg"
                active-class="!text-white !bg-accent"
              >
                <span v-html="child.icon" class="flex-shrink-0"></span>
                {{ child.label }}
              </RouterLink>
            </div>
          </template>

          <button
            @click="toggleTheme"
            class="w-full mt-4 flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-fg/80 bg-surface-overlay border border-surface-border hover:text-fg transition-colors"
          >
            <svg v-if="theme === 'dark'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
            {{ theme === 'dark' ? 'Tema claro' : 'Tema escuro' }}
          </button>
          <button
            @click="showCsvImport = true; showMore = false"
            class="w-full mt-2 flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-fg/80 bg-surface-overlay border border-surface-border hover:bg-accent/10 hover:text-fg transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
            Importar CSV
          </button>
          <button
            @click="logout"
            class="w-full mt-2 flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-red-500 bg-surface-overlay border border-surface-border hover:bg-red-500/10 transition-colors"
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
    <GlobalConfirmDialog />
    <CsvImportModal
      :open="showCsvImport"
      @close="showCsvImport = false"
    />
  </div>
</template>

<style scoped>
/* Botão do rail: quadrado arredondado; ativo vira pílula lima com ícone escuro. */
.rail-btn {
  @apply relative flex items-center justify-center w-11 h-11 rounded-2xl text-white/55
         transition-all duration-200 ease-smooth hover:text-white hover:bg-white/10;
}
.rail-btn--active {
  @apply text-ink-950 bg-lime shadow-lg shadow-lime/30 hover:bg-lime hover:text-ink-950;
}
/* Etiqueta ao lado do ícone. */
.rail-tip {
  @apply pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 whitespace-nowrap
         rounded-full bg-ink-950 text-white text-[11px] font-semibold px-3 py-1.5
         border border-white/10 shadow-lg z-50
         opacity-0 -translate-x-1 transition-all duration-200
         group-hover/nav:opacity-100 group-hover/nav:translate-x-0;
}
/* Popup com dados: o wrapper tem padding à esquerda para o mouse atravessar
   o vão entre o rail e o painel sem fechar. */
.rail-pop-wrap {
  @apply absolute left-full top-0 pl-3 z-50 invisible opacity-0 -translate-x-2 transition-all duration-200
         group-hover/nav:visible group-hover/nav:opacity-100 group-hover/nav:translate-x-0;
}
.rail-pop {
  @apply w-72 rounded-2xl bg-surface-raised border border-surface-border shadow-card-hover
         overflow-hidden text-fg;
}
.rail-pop-head {
  @apply px-4 py-3 border-b border-surface-border bg-surface-overlay/60 flex justify-between items-center;
}
.rail-pop-title {
  @apply text-[11px] font-bold text-fg uppercase tracking-widest flex items-center gap-2;
}
.rail-pop-row {
  @apply p-2.5 rounded-xl hover:bg-surface-overlay transition-colors cursor-pointer;
}
</style>
