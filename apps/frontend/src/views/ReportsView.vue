<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api } from '@moneyapp/api-client';
import AppShell from '../components/AppShell.vue';
import EmptyState from '../components/EmptyState.vue';
import type { CategoryRankingResponse } from '@moneyapp/models';

const ranking = ref<CategoryRankingResponse | null>(null);
const loading = ref(true);

const filterType = ref<'expense' | 'income'>('expense');
const filterPeriod = ref<string>('');

const months = computed(() => {
  const result = [];
  const now = new Date();
  for (let i = -6; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    let label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    label = label.charAt(0).toUpperCase() + label.slice(1);
    result.push({ value: val, label });
  }
  return result;
});

if (!filterPeriod.value) {
  const now = new Date();
  filterPeriod.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

async function reload() {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    params.set('type', filterType.value);
    params.set('month', filterPeriod.value);
    params.set('includeZero', 'false');
    
    ranking.value = await api.get<CategoryRankingResponse>(`/dashboard/categories/ranking?${params.toString()}`);
  } catch (err) {
    console.error('Failed to load ranking', err);
  } finally {
    loading.value = false;
  }
}

onMounted(reload);

const brl = (n: number | string) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
</script>

<template>
  <AppShell>
    <div class="mx-auto max-w-6xl px-6 py-8 relative z-10">
      <!-- Header -->
      <header class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <h1 class="text-3xl font-bold tracking-tight text-white mb-1">Relatórios</h1>
          <p class="text-sm text-zinc-400">Acompanhe seus gastos e recebimentos por categoria.</p>
        </div>
        
        <div class="flex items-center gap-3 w-full sm:w-auto">
          <div class="flex rounded-xl border border-surface-border bg-surface-raised p-1 shadow-lg w-full sm:w-auto">
            <button
              class="flex-1 sm:flex-none px-4 py-1.5 text-sm font-medium rounded-lg transition-colors duration-200"
              :class="filterType === 'expense' ? 'bg-surface-overlay text-white shadow' : 'text-muted hover:text-white'"
              @click="filterType = 'expense'; reload()"
            >
              Despesas
            </button>
            <button
              class="flex-1 sm:flex-none px-4 py-1.5 text-sm font-medium rounded-lg transition-colors duration-200"
              :class="filterType === 'income' ? 'bg-surface-overlay text-white shadow' : 'text-muted hover:text-white'"
              @click="filterType = 'income'; reload()"
            >
              Receitas
            </button>
          </div>
          
          <select
            v-model="filterPeriod"
            @change="reload()"
            class="min-w-0 px-4 py-2 rounded-xl border border-surface-border bg-surface-raised text-sm font-medium text-white shadow-lg focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer"
          >
            <option v-for="m in months" :key="m.value" :value="m.value">{{ m.label }}</option>
          </select>
        </div>
      </header>

      <!-- Metrics -->
      <div v-if="!loading && ranking" class="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div class="glass-card rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-zinc-400 mb-1">Total do Mês ({{ filterType === 'expense' ? 'Despesas' : 'Receitas' }})</p>
            <p class="text-2xl font-bold font-display" :class="filterType === 'expense' ? 'text-expense' : 'text-income'">
              {{ brl(ranking.totalCurrent) }}
            </p>
          </div>
        </div>
        <div class="glass-card rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-zinc-400 mb-1">Mês Anterior</p>
            <p class="text-2xl font-bold text-white font-display">
              {{ brl(ranking.totalPrevious) }}
            </p>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <section v-if="loading" class="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
        <div v-for="i in 6" :key="i" class="skeleton h-24 w-full rounded-2xl" />
      </section>

      <!-- Empty State -->
      <EmptyState
        v-else-if="!ranking || ranking.ranking.length === 0"
        title="Nenhum dado encontrado"
        description="Você ainda não tem transações para as categorias neste mês."
        action-text=""
        class="mt-12"
      />

      <!-- Populated State -->
      <section v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <article
          v-for="item in ranking.ranking"
          :key="item.categoryId"
          class="glass-card rounded-xl p-4 flex flex-col gap-3 group"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-8 h-8 rounded-lg bg-surface border border-white/5 flex items-center justify-center shrink-0">
                <span class="inline-block w-3 h-3 rounded-full color-glow" :style="{ backgroundColor: item.color || '#6366f1' }"></span>
              </div>
              <h3 class="text-sm font-semibold text-white truncate">{{ item.name }}</h3>
            </div>
            <span class="tabular-nums font-bold text-lg font-display truncate pl-2" :class="filterType === 'expense' ? 'text-expense' : 'text-income'">
              {{ brl(item.current) }}
            </span>
          </div>
          
          <div class="w-full h-1.5 bg-surface rounded-full overflow-hidden">
            <div class="h-full rounded-full transition-all duration-500 ease-out" 
                 :style="{ width: `${Math.min(100, item.share)}%`, backgroundColor: item.color || '#6366f1' }"></div>
          </div>
          
          <div class="flex justify-between items-center text-xs text-zinc-400">
            <span>{{ item.share.toFixed(1) }}% do total</span>
            <span v-if="item.variationPct !== null" :class="item.variationPct >= 0 ? 'text-expense' : 'text-income'">
              {{ item.variationPct > 0 ? '+' : '' }}{{ item.variationPct.toFixed(1) }}% vs anterior
            </span>
            <span v-else class="text-zinc-500">Novo</span>
          </div>
        </article>
      </section>
    </div>
  </AppShell>
</template>

<style scoped>
.glass-card {
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.05);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  transition: all 0.2s ease-in-out;
}

.glass-card:hover {
  border-color: rgba(255, 255, 255, 0.1);
  transform: translateY(-2px);
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2), 0 4px 6px -2px rgba(0, 0, 0, 0.1);
}

.color-glow {
  position: relative;
}
.color-glow::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 150%;
  height: 150%;
  border-radius: 50%;
  background: inherit;
  filter: blur(10px);
  opacity: 0.4;
  z-index: -1;
}
</style>
