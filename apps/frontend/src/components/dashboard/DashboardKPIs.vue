<script setup lang="ts">
import type { DashboardSummaryResponse } from '@moneyapp/models';

const props = defineProps<{
  summary: DashboardSummaryResponse | null;
  subscriptionsSummary: any | null;
  loading: boolean;
}>();

const brl = (n: number | string) =>
  Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const kpis = [
  { key: 'closingBalance', label: 'Saldo Atual', tone: '' as const, icon: '💰' },
  { key: 'creditCardBalance', label: 'Cartões', tone: 'expense' as const, icon: '💳' },
  { key: 'income',         label: 'Receitas',      tone: 'income' as const, icon: '📈' },
  { key: 'expense',        label: 'Despesas',      tone: 'expense' as const, icon: '📉' },
  { key: 'fixedCosts',     label: 'Custo Fixo',    tone: 'expense' as const, icon: '🔄' },
] as const;

function toneClass(tone: string): string {
  if (tone === 'income') return 'text-income';
  if (tone === 'expense') return 'text-expense';
  return 'text-white';
}

function formatKpi(s: DashboardSummaryResponse, key: typeof kpis[number]['key']): string {
  if (key === 'fixedCosts') return brl(props.subscriptionsSummary?.gastoMensal ?? 0);
  return brl(s[key as keyof DashboardSummaryResponse] as number);
}
</script>

<template>
  <section class="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-6">
    <div v-for="(k, idx) in kpis" :key="k.key" 
         class="card relative overflow-hidden group animate-fade-in-up"
         :style="{ animationDelay: `${idx * 100}ms` }">
      <div class="flex justify-between items-start">
        <div>
          <div class="text-[11px] font-semibold text-muted uppercase tracking-wider mb-2">{{ k.label }}</div>
          <div v-if="loading" class="skeleton h-8 w-24" />
          <div v-else-if="summary" class="text-2xl font-bold tabular-nums font-display" :class="toneClass(k.tone)">
            {{ formatKpi(summary, k.key) }}
          </div>
        </div>
        <div class="p-3 bg-surface-overlay/80 rounded-lg text-xl group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
          {{ k.icon }}
        </div>
      </div>
    </div>
  </section>
</template>
