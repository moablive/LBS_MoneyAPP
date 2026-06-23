<script setup lang="ts">
import type { CategoryRankingResponse } from '@moneyapp/models';

defineProps<{
  ranking: CategoryRankingResponse | null;
  loading: boolean;
}>();

const brl = (n: number | string) =>
  Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
</script>

<template>
  <div class="card flex flex-col animate-fade-in-up delay-300">
    <h2 class="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Análise</h2>
    <h3 class="text-lg text-white font-medium mb-6 font-display">Principais Categorias</h3>
    
    <div v-if="loading" class="space-y-4">
      <div v-for="i in 5" :key="i" class="skeleton h-12 w-full" />
    </div>
    <ul v-else-if="ranking" class="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
      <li v-for="(item, idx) in ranking.ranking" :key="item.categoryId" 
          class="space-y-1.5 animate-fade-in-up"
          :style="{ animationDelay: `${(idx * 75) + 400}ms` }">
        <div class="flex items-baseline justify-between text-sm gap-2 min-w-0">
          <span class="font-medium text-white/90 truncate">{{ item.name }}</span>
          <span class="tabular-nums font-semibold font-display shrink-0">{{ brl(item.current) }}</span>
        </div>
        <div class="h-1.5 rounded-full bg-surface-overlay overflow-hidden">
          <div class="h-full transition-[width] duration-500 ease-smooth" :style="{ width: `${Math.min(100, item.share)}%`, backgroundColor: item.color || '#d946ef' }" />
        </div>
        <div class="flex justify-between text-[11px] text-muted">
          <span>Anterior: {{ brl(item.previous) }}</span>
          <span v-if="item.variationPct !== null" :class="item.variationPct >= 0 ? 'text-expense' : 'text-accent'">
            {{ item.variationPct >= 0 ? '+' : '' }}{{ item.variationPct.toFixed(1) }}%
          </span>
          <span v-else class="text-muted">novo</span>
        </div>
      </li>
    </ul>
  </div>
</template>
