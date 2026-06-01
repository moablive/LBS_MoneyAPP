<script setup lang="ts">
import { ref } from 'vue';
import { RouterLink, useRouter, useRoute } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import NewTransactionModal from './NewTransactionModal.vue';
import GlobalConfirmDialog from './GlobalConfirmDialog.vue';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();
const showGlobalCreate = ref(false);

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
    ]
  },
  { to: '/contas',     label: 'Contas',      icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a8 8 0 0 1-5.45 7.49 1 1 0 0 1-1.22-1.08L14 16.5a1 1 0 0 0-1-1H7.5a1 1 0 0 0-1 1L5.5 20.41a1 1 0 0 1-1.22 1.08A8 8 0 0 1 2 14v-5"/><path d="M20 12v4M20 16a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2"/></svg>' },
  { to: '/investimentos', label: 'Investimentos', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>' },
  { to: '/categorias', label: 'Categorias',  icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/></svg>' },
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
</script>

<template>
  <div class="min-h-dvh flex bg-surface-base">
    <aside class="hidden sm:flex w-64 shrink-0 flex-col bg-surface-raised border-r border-surface-border shadow-xl z-10">
      <div class="px-6 py-6 flex flex-col items-center justify-center border-b border-white/10 mb-4 gap-3">
        <img :src="logoSrc" @error="retryLogo" alt="MoneyAPP" class="h-12 w-auto object-contain" />
        <div class="text-[11px] text-slate-300 truncate max-w-full font-medium tracking-wide bg-surface-overlay px-3 py-1 rounded-full border border-surface-border shadow-inner">
          {{ auth.user?.email }}
        </div>
      </div>
      <nav class="flex-1 px-4 space-y-1">
        <template v-for="item in nav" :key="item.label">
          <!-- Normal Link -->
          <RouterLink
            v-if="!item.children"
            :to="item.to!"
            class="nav-link group relative flex items-center gap-4 px-4 py-3.5 mx-2 rounded-lg text-[13px] font-semibold uppercase tracking-wider
                   text-muted transition-all duration-300 ease-smooth
                   hover:text-white hover:bg-surface-overlay"
            active-class="nav-link--active !text-white !bg-accent shadow-lg shadow-accent/30"
          >
            <span v-html="item.icon" class="flex-shrink-0 transition-transform duration-300 group-hover:scale-110"></span>
            {{ item.label }}
          </RouterLink>

          <!-- Dropdown -->
          <div v-else class="flex flex-col">
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

      <!-- Logout directly on mobile instead of deep menus for simplicity, or we could add a profile menu -->
      <button @click="logout" class="p-2 flex flex-col items-center gap-1 text-muted transition-colors hover:text-red-400">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
        <span class="text-[10px] font-medium">Sair</span>
      </button>
    </nav>

    <NewTransactionModal 
      :open="showGlobalCreate" 
      @close="showGlobalCreate = false" 
    />
    <GlobalConfirmDialog />
  </div>
</template>
