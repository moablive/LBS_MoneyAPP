<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  accounts: any[];
  loading: boolean;
}>();

const emit = defineEmits<{
  (e: 'edit-account', acc: any): void;
}>();

const totalPositiveBalance = computed(() => {
  return sortedAccounts.value.reduce((acc, account) => {
    const bal = Number(account.currentBalance);
    return acc + (bal > 0 ? bal : 0);
  }, 0);
});

const getAccountShare = (balance: number | string) => {
  const num = Number(balance);
  if (totalPositiveBalance.value === 0 || num <= 0) return 0;
  return (num / totalPositiveBalance.value) * 100;
};

const sortedAccounts = computed(() => {
  return props.accounts
    .filter(a => a.type !== 'credit_card')
    .sort((a, b) => Number(b.currentBalance) - Number(a.currentBalance));
});

const brl = (n: number | string) =>
  Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
</script>

<template>
  <div class="card flex flex-col animate-fade-in-up delay-200">
    <h2 class="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Saldos</h2>
    <h3 class="text-lg text-white font-medium mb-6 font-display">Minhas Contas</h3>
    
    <div v-if="loading" class="space-y-4">
      <div v-for="i in 4" :key="i" class="skeleton h-14 w-full" />
    </div>
    <ul v-else class="space-y-4 max-h-[500px] overflow-y-auto pr-4 custom-scrollbar">
      <li v-for="(acc, idx) in sortedAccounts" :key="acc.id" 
          class="cursor-pointer group hover:bg-surface-overlay/60 p-2 -ml-2 mr-1 rounded-xl transition-colors animate-fade-in-up"
          :style="{ animationDelay: `${(idx * 75) + 300}ms` }"
          @click="emit('edit-account', acc)">
        <div class="flex items-center gap-3 mb-1.5">
          <div class="flex items-center justify-center w-8 h-8 rounded-lg bg-surface-base/50 border border-surface-border shrink-0 group-hover:scale-105 transition-transform">
            <img v-if="acc.customIconUrl" :src="acc.customIconUrl" class="w-5 h-5 rounded-md object-contain" />
            <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-accent"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a8 8 0 0 1-5.45 7.49 1 1 0 0 1-1.22-1.08L14 16.5a1 1 0 0 0-1-1H7.5a1 1 0 0 0-1 1L5.5 20.41a1 1 0 0 1-1.22 1.08A8 8 0 0 1 2 14v-5"/><path d="M20 12v4M20 16a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2"/></svg>
          </div>
          <div class="flex-1 flex items-baseline justify-between text-sm gap-2 min-w-0">
            <span class="font-medium text-white/90 group-hover:text-accent transition-colors truncate">{{ acc.name }}</span>
            <span class="tabular-nums font-semibold font-display shrink-0" :class="Number(acc.currentBalance) >= 0 ? 'text-white' : 'text-expense'">{{ brl(Number(acc.currentBalance)) }}</span>
          </div>
        </div>
        <div class="h-1.5 rounded-full bg-surface-overlay overflow-hidden ml-11">
          <div class="h-full bg-accent transition-[width] duration-500 ease-smooth" :style="{ width: `${Math.min(100, getAccountShare(acc.currentBalance))}%` }" />
        </div>
      </li>
    </ul>
  </div>
</template>
