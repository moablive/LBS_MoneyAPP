<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  accounts: any[];
  loading: boolean;
}>();

const emit = defineEmits<{
  (e: 'action', account: any): void;
}>();

const creditCards = computed(() => {
  return props.accounts.filter(a => a.type === 'credit_card');
});

const brl = (n: number | string) =>
  Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
</script>

<template>
  <div class="card flex flex-col animate-fade-in-up delay-200">
    <h2 class="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Faturas</h2>
    <h3 class="text-lg text-white font-medium mb-6 font-display">Meus Cartões</h3>
    
    <div v-if="loading" class="space-y-4">
      <div v-for="i in 3" :key="i" class="skeleton h-14 w-full" />
    </div>
    <div v-else-if="creditCards.length === 0" class="flex-1 flex flex-col items-center justify-center text-center text-muted py-6">
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="mb-3 opacity-20"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
      <span class="text-sm">Nenhum cartão.</span>
    </div>
    <ul v-else class="space-y-4 max-h-[500px] overflow-y-auto pr-4 custom-scrollbar">
      <li v-for="(card, idx) in creditCards" :key="card.id" 
          @click="emit('action', card)"
          class="relative group p-2 -ml-2 mr-1 rounded-xl hover:bg-surface-overlay/60 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 transition-all cursor-pointer animate-fade-in-up"
          :style="{ animationDelay: `${(idx * 75) + 300}ms` }">
        <div class="flex items-center gap-3 mb-1.5">
          <div class="flex items-center justify-center w-8 h-8 rounded-lg bg-surface-base/50 border border-surface-border shrink-0 group-hover:scale-105 transition-transform">
            <img v-if="card.customIconUrl" :src="card.customIconUrl" class="w-5 h-5 rounded-md object-contain" />
            <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-accent"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
          </div>
          <div class="flex-1 flex flex-col justify-center text-sm">
            <div class="flex items-baseline justify-between gap-2 min-w-0">
              <span class="font-medium text-white/90 truncate">{{ card.name }}</span>
              <span class="tabular-nums font-semibold font-display text-expense shrink-0">{{ brl(Math.abs(Number(card.currentBalance))) }}</span>
            </div>
            <div class="text-[10px] text-muted uppercase font-semibold tracking-wide flex justify-between" v-if="card.closingDay">
              <span>Vence dia {{ card.dueDay || card.closingDay }}</span>
              <span v-if="card.creditLimit && Number(card.creditLimit) > 0">Livre: {{ brl(Number(card.creditLimit) - Math.abs(Number(card.currentBalance))) }}</span>
            </div>
          </div>
        </div>
        <div class="h-1.5 rounded-full bg-surface-overlay overflow-hidden ml-11" v-if="card.creditLimit && Number(card.creditLimit) > 0">
          <div class="h-full bg-expense transition-[width] duration-500 ease-smooth" :style="{ width: `${Math.min(100, Math.max(0, (Math.abs(Number(card.currentBalance)) / Number(card.creditLimit)) * 100))}%` }" />
        </div>
      </li>
    </ul>
  </div>
</template>
