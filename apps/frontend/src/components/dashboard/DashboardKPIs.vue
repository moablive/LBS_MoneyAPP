<script setup lang="ts">
import { computed } from 'vue';
import type { DashboardSummaryResponse, SpendingEvolutionResponse } from '@moneyapp/models';
import Sparkline from '../Sparkline.vue';

/**
 * Faixa de KPIs no estilo "stat card" da referência V5: etiqueta, valor
 * grande, chip de variação e um mini-gráfico no rodapé (linha, barras ou
 * barra de proporção), cada um com dado real do mês.
 */
const props = defineProps<{
  summary: DashboardSummaryResponse | null;
  subscriptionsSummary: any | null;
  evolution: SpendingEvolutionResponse | null;
  accounts: any[];
  loading: boolean;
}>();

const brl = (n: number | string) =>
  Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;

const fixedCosts = computed(() => {
  const mensal = props.subscriptionsSummary?.gastoMensal ?? 0;
  const terceiros = props.subscriptionsSummary?.gastoTerceiros ?? 0;
  return mensal + terceiros;
});
const activeSubs = computed(() =>
  (props.subscriptionsSummary?.items ?? []).filter((i: any) => i.status === 'active').length,
);

/** Variação do saldo dentro do mês (fechamento − abertura). */
const balanceDelta = computed(() =>
  props.summary ? props.summary.closingBalance - props.summary.openingBalance : 0,
);

/** Despesas vs. mês anterior, pela evolução acumulada (mesma base do gráfico). */
const expenseVariation = computed<number | null>(() => {
  const ev = props.evolution;
  if (!ev || ev.totalPrevious <= 0) return null;
  return ((ev.totalCurrent - ev.totalPrevious) / ev.totalPrevious) * 100;
});
const expenseSeries = computed(() => (props.evolution?.series ?? []).map(p => p.current));

/** Quanto das receitas já foi consumido por despesas (0–100+). */
const expenseShare = computed(() => {
  if (!props.summary || props.summary.income <= 0) return 0;
  return (props.summary.expense / props.summary.income) * 100;
});
const fixedShare = computed(() => {
  if (!props.summary || props.summary.income <= 0) return 0;
  return (fixedCosts.value / props.summary.income) * 100;
});

/** Mini-barras: fatura de cada cartão em relação à maior. */
const cardBars = computed(() => {
  const cards = props.accounts.filter(a => a.type === 'credit_card');
  const vals = cards.map(c => Math.abs(Number(c.currentBalance)));
  const max = Math.max(1, ...vals);
  return cards.map((c, i) => ({ id: c.id, name: c.name, h: Math.max(8, ((vals[i] ?? 0) / max) * 100) }));
});
</script>

<template>
  <section class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
    <!-- Saldo atual -->
    <div class="kpi animate-fade-in-up" style="animation-delay: 0ms">
      <div class="kpi-head">
        <span class="kpi-label">Saldo atual</span>
        <span class="kpi-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a8 8 0 0 1-5.45 7.49 1 1 0 0 1-1.22-1.08L14 16.5a1 1 0 0 0-1-1H7.5a1 1 0 0 0-1 1L5.5 20.41a1 1 0 0 1-1.22 1.08A8 8 0 0 1 2 14v-5"/></svg>
        </span>
      </div>
      <div v-if="loading" class="skeleton h-8 w-28" />
      <div v-else-if="summary" class="kpi-value">{{ brl(summary.closingBalance) }}</div>
      <div v-if="summary && !loading" class="kpi-sub">
        <span class="chip" :class="balanceDelta >= 0 ? 'bg-income/10 text-income' : 'bg-expense/10 text-expense'">
          {{ balanceDelta >= 0 ? '↑' : '↓' }} {{ brl(Math.abs(balanceDelta)) }}
        </span>
        <span class="text-muted">no mês</span>
      </div>
      <div v-if="summary && !loading" class="mt-auto pt-3">
        <div class="flex justify-between text-[10px] text-muted mb-1">
          <span>Entradas</span><span>Saídas</span>
        </div>
        <div class="flex h-1.5 rounded-full overflow-hidden bg-surface-overlay">
          <div class="bg-income" :style="{ width: `${summary.income + summary.expense > 0 ? (summary.income / (summary.income + summary.expense)) * 100 : 50}%` }" />
          <div class="bg-expense flex-1" />
        </div>
      </div>
    </div>

    <!-- Cartões -->
    <div class="kpi animate-fade-in-up" style="animation-delay: 80ms">
      <div class="kpi-head">
        <span class="kpi-label">Faturas dos cartões</span>
        <span class="kpi-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
        </span>
      </div>
      <div v-if="loading" class="skeleton h-8 w-28" />
      <div v-else-if="summary" class="kpi-value text-expense">{{ brl(summary.creditCardBalance) }}</div>
      <div v-if="!loading" class="kpi-sub">
        <span class="chip bg-surface-overlay text-fg/70">{{ cardBars.length }} {{ cardBars.length === 1 ? 'cartão' : 'cartões' }}</span>
        <span class="text-muted">em aberto</span>
      </div>
      <div v-if="!loading" class="mt-auto pt-3 flex items-end gap-1.5 h-12">
        <div
          v-for="b in cardBars"
          :key="b.id"
          class="flex-1 rounded-md bg-expense/80 hover:bg-expense transition-colors"
          :style="{ height: `${b.h}%` }"
          :title="b.name"
        />
        <div v-if="cardBars.length === 0" class="w-full text-[11px] text-muted">Nenhum cartão cadastrado.</div>
      </div>
    </div>

    <!-- Receitas -->
    <div class="kpi animate-fade-in-up" style="animation-delay: 160ms">
      <div class="kpi-head">
        <span class="kpi-label">Receitas</span>
        <span class="kpi-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
        </span>
      </div>
      <div v-if="loading" class="skeleton h-8 w-28" />
      <div v-else-if="summary" class="kpi-value text-income">{{ brl(summary.income) }}</div>
      <div v-if="summary && !loading" class="kpi-sub">
        <span class="chip" :class="summary.savingsPct >= 0 ? 'bg-income/10 text-income' : 'bg-expense/10 text-expense'">
          {{ pct(summary.savingsPct) }}
        </span>
        <span class="text-muted">sobra do mês</span>
      </div>
      <div v-if="summary && !loading" class="mt-auto pt-3">
        <div class="flex justify-between text-[10px] text-muted mb-1">
          <span>Comprometido</span><span class="tabular-nums">{{ expenseShare.toFixed(0) }}%</span>
        </div>
        <div class="h-1.5 rounded-full bg-surface-overlay overflow-hidden">
          <div class="h-full rounded-full transition-[width] duration-700 ease-smooth" :class="expenseShare > 100 ? 'bg-expense' : 'bg-income'" :style="{ width: `${Math.min(100, expenseShare)}%` }" />
        </div>
      </div>
    </div>

    <!-- Despesas -->
    <div class="kpi animate-fade-in-up" style="animation-delay: 240ms">
      <div class="kpi-head">
        <span class="kpi-label">Despesas</span>
        <span class="kpi-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/></svg>
        </span>
      </div>
      <div v-if="loading" class="skeleton h-8 w-28" />
      <div v-else-if="summary" class="kpi-value text-expense">{{ brl(summary.expense) }}</div>
      <div v-if="summary && !loading" class="kpi-sub">
        <span v-if="expenseVariation !== null" class="chip" :class="expenseVariation <= 0 ? 'bg-income/10 text-income' : 'bg-expense/10 text-expense'">
          {{ pct(expenseVariation) }}
        </span>
        <span v-else class="chip bg-surface-overlay text-fg/70">sem base</span>
        <span class="text-muted">vs. mês anterior</span>
      </div>
      <div v-if="!loading" class="mt-auto pt-2 h-12 text-expense">
        <Sparkline v-if="expenseSeries.length > 1" :values="expenseSeries" color="currentColor" />
        <div v-else class="text-[11px] text-muted">Sem lançamentos no mês.</div>
      </div>
    </div>

    <!-- Custo fixo (card lima, como o destaque da referência) -->
    <div class="kpi kpi--lime animate-fade-in-up" style="animation-delay: 320ms">
      <div class="kpi-head">
        <span class="kpi-label !text-ink-950/70">Custo fixo</span>
        <span class="kpi-icon !bg-ink-950/10 !text-ink-950">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>
        </span>
      </div>
      <div v-if="loading" class="skeleton h-8 w-28 !bg-ink-950/10" />
      <div v-else class="kpi-value !text-ink-950">{{ brl(fixedCosts) }}</div>
      <div v-if="!loading" class="kpi-sub">
        <span class="chip bg-ink-950 text-white">{{ activeSubs }} {{ activeSubs === 1 ? 'ativa' : 'ativas' }}</span>
        <span class="text-ink-950/60">por mês</span>
      </div>
      <div v-if="!loading" class="mt-auto pt-3">
        <div class="flex justify-between text-[10px] text-ink-950/60 mb-1">
          <span>Das receitas</span><span class="tabular-nums">{{ fixedShare.toFixed(0) }}%</span>
        </div>
        <div class="h-1.5 rounded-full bg-ink-950/15 overflow-hidden mb-2.5">
          <div class="h-full rounded-full bg-ink-950 transition-[width] duration-700 ease-smooth" :style="{ width: `${Math.min(100, fixedShare)}%` }" />
        </div>
        <RouterLink to="/recorrentes" class="text-[11px] font-semibold text-ink-950 inline-flex items-center gap-1 hover:gap-2 transition-all">
          Ver mensalidades
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg>
        </RouterLink>
      </div>
    </div>
  </section>
</template>

<style scoped>
.kpi {
  @apply card card-hover relative overflow-hidden flex flex-col gap-2 min-h-[164px];
}
.kpi--lime {
  @apply bg-lime border-lime text-ink-950;
}
.kpi-head {
  @apply flex items-center justify-between;
}
.kpi-label {
  @apply text-xs font-semibold text-muted;
}
.kpi-icon {
  @apply w-8 h-8 rounded-xl bg-surface-overlay text-fg/70 flex items-center justify-center;
}
.kpi-value {
  @apply text-2xl font-bold font-display tabular-nums tracking-tight text-fg;
}
.kpi-sub {
  @apply flex items-center gap-2 text-[11px];
}
</style>
