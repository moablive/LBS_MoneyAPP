<script setup lang="ts">
import { computed } from 'vue';
import type { CategoryRankingResponse } from '@moneyapp/models';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
} from 'chart.js';
import { Radar } from 'vue-chartjs';
import { useTheme } from '../../composables/useTheme';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip);

const props = defineProps<{
  ranking: CategoryRankingResponse | null;
  loading: boolean;
}>();

const { theme } = useTheme();

const brl = (n: number | string) =>
  Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Radar "Spending" da referência: as 6 maiores categorias do mês. */
const top = computed(() =>
  (props.ranking?.ranking ?? []).filter(i => i.current > 0).slice(0, 6),
);
const showRadar = computed(() => top.value.length >= 3);

const chartData = computed(() => {
  const dark = theme.value === 'dark';
  return {
    labels: top.value.map(i => i.name),
    datasets: [
      {
        data: top.value.map(i => i.current),
        fill: true,
        backgroundColor: dark ? 'rgba(198, 241, 53, 0.22)' : 'rgba(198, 241, 53, 0.55)',
        borderColor: dark ? '#c6f135' : '#111113',
        borderWidth: 2,
        pointBackgroundColor: dark ? '#c6f135' : '#111113',
        pointBorderColor: dark ? '#121215' : '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 3.5,
        tension: 0.15,
      },
    ],
  };
});

const chartOptions = computed(() => {
  const dark = theme.value === 'dark';
  const grid = dark ? 'rgba(255,255,255,0.08)' : 'rgba(17,17,19,0.08)';
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 900, easing: 'easeOutQuart' as const },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: dark ? '#272730' : '#111113',
        titleColor: '#fff',
        bodyColor: '#fff',
        padding: 10,
        cornerRadius: 10,
        displayColors: false,
        callbacks: { label: (ctx: any) => brl(ctx.parsed.r) },
      },
    },
    scales: {
      r: {
        beginAtZero: true,
        ticks: { display: false },
        grid: { color: grid, circular: true },
        angleLines: { color: grid },
        pointLabels: {
          color: dark ? '#9aa3b8' : '#6b707a',
          font: { size: 10, family: 'Inter', weight: 600 as const },
        },
      },
    },
  };
});
</script>

<template>
  <div class="card flex flex-col animate-fade-in-up delay-300">
    <h2 class="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Análise</h2>
    <h3 class="text-lg text-fg font-semibold mb-4 font-display">Principais Categorias</h3>

    <div v-if="loading" class="space-y-4">
      <div class="skeleton h-44 w-full rounded-2xl" />
      <div v-for="i in 3" :key="i" class="skeleton h-10 w-full" />
    </div>
    <template v-else-if="ranking">
      <div v-if="showRadar" class="h-48 -mx-2 mb-4">
        <Radar :data="chartData" :options="chartOptions" />
      </div>
      <ul class="space-y-3.5 max-h-[420px] overflow-y-auto pr-2 custom-scrollbar">
        <li v-for="(item, idx) in ranking.ranking" :key="item.categoryId"
            class="space-y-1.5 animate-fade-in-up"
            :style="{ animationDelay: `${(idx * 60) + 400}ms` }">
          <div class="flex items-baseline justify-between text-sm gap-2 min-w-0">
            <span class="font-medium text-fg flex items-center gap-2 min-w-0">
              <span class="w-2 h-2 rounded-full shrink-0" :style="{ backgroundColor: item.color || '#111113' }"></span>
              <span class="truncate">{{ item.name }}</span>
            </span>
            <span class="tabular-nums font-semibold font-display shrink-0">{{ brl(item.current) }}</span>
          </div>
          <div class="h-1.5 rounded-full bg-surface-overlay overflow-hidden">
            <div class="h-full rounded-full transition-[width] duration-700 ease-smooth" :style="{ width: `${Math.min(100, item.share)}%`, backgroundColor: item.color || '#111113' }" />
          </div>
          <div class="flex justify-between text-[11px] text-muted">
            <span>Anterior: {{ brl(item.previous) }}</span>
            <span v-if="item.variationPct !== null" class="chip !px-1.5 !py-0" :class="item.variationPct >= 0 ? 'bg-expense/10 text-expense' : 'bg-income/10 text-income'">
              {{ item.variationPct >= 0 ? '+' : '' }}{{ item.variationPct.toFixed(1) }}%
            </span>
            <span v-else class="text-muted">novo</span>
          </div>
        </li>
      </ul>
    </template>
  </div>
</template>
