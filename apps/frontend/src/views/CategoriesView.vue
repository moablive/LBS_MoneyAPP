<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { api } from '@moneyapp/shared';
import AppShell from '../components/AppShell.vue';
import NewCategoryModal from '../components/NewCategoryModal.vue';
import EmptyState from '../components/EmptyState.vue';
import type { Category } from '@moneyapp/shared';

const items = ref<Category[]>([]);
const loading = ref(true);
const showCreate = ref(false);
const categoryToEdit = ref<Category | null>(null);

function openCreateModal() {
  categoryToEdit.value = null;
  showCreate.value = true;
}

function openEditModal(item: Category) {
  categoryToEdit.value = item;
  showCreate.value = true;
}

const totalCategories = computed(() => items.value.length);
const totalExpenses = computed(() => items.value.filter(c => c.type === 'expense').length);
const totalIncomes = computed(() => items.value.filter(c => c.type === 'income').length);

async function reload() {
  loading.value = true;
  try {
    items.value = await api.get<Category[]>('/categories');
  } finally {
    loading.value = false;
  }
}

onMounted(reload);
</script>

<template>
  <AppShell>
    <div class="mx-auto max-w-6xl px-6 py-8 relative z-10">
      <!-- Header -->
      <header class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <h1 class="text-3xl font-bold tracking-tight text-white mb-1">Categorias</h1>
          <p class="text-sm text-zinc-400">Gerencie a classificação das suas finanças.</p>
        </div>
        <div class="flex items-center gap-3">
          <button
            class="px-4 py-2 rounded-xl bg-accent hover:opacity-90 text-white text-sm font-medium shadow-lg shadow-accent/20 transition-all flex items-center gap-2"
            @click="openCreateModal"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            Nova Categoria
          </button>
        </div>
      </header>

      <!-- Metrics -->
      <div v-if="!loading && items.length > 0" class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div class="glass-card rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-zinc-400 mb-1">Total Cadastradas</p>
            <p class="text-2xl font-bold text-white">{{ totalCategories }}</p>
          </div>
          <div class="w-10 h-10 rounded-full bg-surface border border-white/5 flex items-center justify-center">
            <svg class="w-5 h-5 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
          </div>
        </div>
        <div class="glass-card rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-zinc-400 mb-1">Despesas</p>
            <p class="text-2xl font-bold text-white">{{ totalExpenses }}</p>
          </div>
          <div class="w-10 h-10 rounded-full bg-expense/10 border border-expense/20 flex items-center justify-center">
            <svg class="w-5 h-5 text-expense" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"/></svg>
          </div>
        </div>
        <div class="glass-card rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-zinc-400 mb-1">Receitas</p>
            <p class="text-2xl font-bold text-white">{{ totalIncomes }}</p>
          </div>
          <div class="w-10 h-10 rounded-full bg-income/10 border border-income/20 flex items-center justify-center">
            <svg class="w-5 h-5 text-income" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <section v-if="loading" class="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
        <div v-for="i in 6" :key="i" class="skeleton h-20 w-full rounded-2xl" />
      </section>

      <!-- Empty State -->
      <EmptyState
        v-else-if="items.length === 0"
        title="Nenhuma categoria cadastrada"
        description="As categorias ajudam você a organizar suas transações e entender melhor para onde está indo o seu dinheiro."
        action-text="Criar Primeira Categoria"
        class="mt-12"
        @action="openCreateModal"
      />

      <!-- Populated State -->
      <section v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <article
          v-for="c in items"
          :key="c.id"
          class="glass-card rounded-xl p-3 px-4 flex items-center gap-3 group cursor-pointer"
          @click="openEditModal(c)"
        >
          <div class="w-8 h-8 rounded-lg bg-surface border border-white/5 flex items-center justify-center shrink-0">
            <span class="inline-block w-3 h-3 rounded-full color-glow" :style="{ backgroundColor: c.color ?? '#6366f1' }"></span>
          </div>
          <div class="flex-1 min-w-0 flex items-center gap-3">
            <h3 class="text-sm font-semibold text-white truncate">{{ c.name }}</h3>
            <span
              class="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] uppercase font-bold tracking-wider ring-1 ring-inset shrink-0"
              :class="c.type === 'expense' ? 'bg-expense/10 text-expense ring-expense/20' : 'bg-income/10 text-income ring-income/20'"
            >
              {{ c.type === 'expense' ? 'Despesa' : 'Receita' }}
            </span>
          </div>
          <button 
            @click.stop="openEditModal(c)"
            class="text-zinc-500 hover:text-white p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            title="Editar Categoria"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
          </button>
        </article>
      </section>
    </div>

    <NewCategoryModal
      :open="showCreate"
      :category-to-edit="categoryToEdit"
      @close="showCreate = false"
      @created="reload"
      @deleted="reload"
    />
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
