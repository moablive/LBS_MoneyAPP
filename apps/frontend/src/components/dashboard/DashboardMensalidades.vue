<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  mensalidadesList: any[];
  categoriesMap: Map<string, any>;
  loading: boolean;
  selectedDate?: Date;
}>();

const emit = defineEmits<{
  (e: 'action', item: any): void;
  (e: 'pay', item: any): void;
  (e: 'dismiss', item: any): void;
  (e: 'prevMonth'): void;
  (e: 'nextMonth'): void;
  (e: 'resetMonth'): void;
}>();

const brl = (n: number | string) =>
  Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatDay = (iso: string) => {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return {
    day: d.toLocaleDateString('pt-BR', { day: '2-digit', timeZone: 'UTC' }),
    month: d.toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' }).replace('.', '').slice(0, 3)
  };
};

const formatMonthSeparator = (iso: string) => {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  const num = d.toLocaleDateString('pt-BR', { month: '2-digit', timeZone: 'UTC' });
  const name = d.toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' });
  return `MÊS ${num} • ${name}`;
};

const isCurrentMonth = (iso: string) => {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  const today = new Date();
  return d.getUTCFullYear() === today.getFullYear() && d.getUTCMonth() === today.getMonth();
};

const formattedCurrentSelectedMonth = computed(() => {
  const date = props.selectedDate || new Date();
  const num = String(date.getMonth() + 1).padStart(2, '0');
  const name = date.toLocaleDateString('pt-BR', { month: 'long' });
  return `MÊS ${num} • ${name}`;
});

const totalUpcoming = computed(() => {
  return props.mensalidadesList
    .filter((t) => t.statusTag !== 'paid')
    .reduce((acc, t) => acc + Number(t.amount), 0);
});
</script>

<template>
  <div class="card flex flex-col animate-fade-in-up delay-400">
    <h2 class="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Assinaturas e Mensalidades</h2>
    
    <div class="flex items-start sm:items-center justify-between mb-6 flex-wrap gap-2">
      <div class="flex items-center gap-2">
        <h3 class="text-lg text-white font-medium font-display">Mensalidades</h3>
        <div class="flex items-center gap-1 bg-surface-base border border-surface-border rounded-lg p-0.5 ml-1">
          <button
            @click="emit('prevMonth')"
            class="p-1 rounded hover:bg-surface-overlay text-muted hover:text-white transition-colors"
            title="Mês Anterior"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <button
            @click="emit('nextMonth')"
            class="p-1 rounded hover:bg-surface-overlay text-muted hover:text-white transition-colors"
            title="Próximo Mês"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </div>
      </div>
      <span v-if="!loading && mensalidadesList.length > 0" class="text-sm font-bold text-expense font-display">
        Total: {{ brl(totalUpcoming) }}
      </span>
    </div>
    
    <div class="flex-1 flex flex-col min-h-[150px]">
      <div v-if="loading" class="space-y-4">
        <div v-for="i in 5" :key="i" class="skeleton h-12 w-full" />
      </div>
      <div v-else-if="mensalidadesList.length === 0" class="flex-1 flex flex-col justify-between">
        <div class="flex items-center gap-2 my-2 opacity-90">
          <div class="h-px flex-1 bg-surface-border"></div>
          <button @click.stop="emit('prevMonth')" class="p-1 rounded-lg hover:bg-surface-overlay text-muted hover:text-white transition-colors" title="Mês Anterior">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <span class="text-[10px] font-bold uppercase tracking-wider text-white">
            {{ formattedCurrentSelectedMonth }}
          </span>
          <button @click.stop="emit('nextMonth')" class="p-1 rounded-lg hover:bg-surface-overlay text-muted hover:text-white transition-colors" title="Próximo Mês">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>
          <div class="h-px flex-1 bg-surface-border"></div>
        </div>
        <div class="flex-1 flex flex-col items-center justify-center py-8 border-2 border-dashed border-surface-border/50 rounded-xl">
          <span class="text-muted text-sm font-medium">Nenhuma assinatura para este mês.</span>
        </div>
      </div>
      <ul v-else class="space-y-4 max-h-[500px] overflow-y-auto pr-4 custom-scrollbar">
      <template v-for="(t, idx) in mensalidadesList" :key="t.id">
        <div v-if="idx === 0 || t.occurredAt.slice(0,7) !== mensalidadesList[idx - 1].occurredAt.slice(0,7)" 
             class="flex items-center gap-2 opacity-90" :class="idx === 0 ? 'mb-2' : 'mt-4 mb-2'">
          <div class="h-px flex-1" :class="isCurrentMonth(t.occurredAt) ? 'bg-accent/50' : 'bg-surface-border'"></div>
          
          <button 
            @click.stop="emit('prevMonth')" 
            class="p-1 rounded-lg hover:bg-surface-overlay text-muted hover:text-white transition-colors cursor-pointer"
            title="Mês Anterior"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>

          <span class="text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 select-none"
                :class="isCurrentMonth(t.occurredAt) ? 'text-accent' : 'text-white'">
            {{ formatMonthSeparator(t.occurredAt) }}
            <button 
              v-if="!isCurrentMonth(t.occurredAt)" 
              @click.stop="emit('resetMonth')"
              class="px-1.5 py-0.5 rounded-full bg-accent/20 text-accent hover:bg-accent/30 text-[8px] leading-none transition-colors"
              title="Voltar para o Mês Atual"
            >
              Hoje
            </button>
            <span v-else class="px-1.5 py-0.5 rounded-full bg-accent/20 text-accent text-[8px] leading-none">
              Hoje {{ new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) }}
            </span>
          </span>

          <button 
            @click.stop="emit('nextMonth')" 
            class="p-1 rounded-lg hover:bg-surface-overlay text-muted hover:text-white transition-colors cursor-pointer"
            title="Próximo Mês"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>

          <div class="h-px flex-1" :class="isCurrentMonth(t.occurredAt) ? 'bg-accent/50' : 'bg-surface-border'"></div>
        </div>

        <li @click="emit('action', t)"
            class="relative flex items-center justify-between group hover:bg-surface-overlay/60 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20 p-2 -ml-2 mr-1 rounded-xl transition-all cursor-pointer animate-fade-in-up"
            :style="{ animationDelay: `${(idx * 75) + 500}ms` }">
          <div class="flex items-center gap-3 min-w-0 w-full">
          <div class="flex flex-col items-center justify-center w-10 h-10 rounded-lg bg-surface-base/50 border border-surface-border shrink-0 group-hover:scale-105 transition-transform">
            <span class="text-[10px] font-bold text-muted uppercase leading-none">{{ formatDay(t.occurredAt).month }}</span>
            <span class="text-sm font-bold text-white leading-none mt-0.5">{{ formatDay(t.occurredAt).day }}</span>
          </div>
          <div class="min-w-0 flex flex-col justify-center flex-1">
            <div class="font-medium text-sm text-white/90 flex items-start gap-1.5 min-w-0">
              <div class="mt-0.5 shrink-0 flex items-center justify-center">
                <img v-if="t.isCreditCard && t.account?.customIconUrl" :src="t.account.customIconUrl" class="w-4 h-4 rounded-sm object-contain" />
                <img v-else-if="t.isSubscription && t.customIconUrl" :src="t.customIconUrl" class="w-4 h-4 rounded-sm object-contain" />
                <svg v-else-if="t.isCreditCard" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-accent"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
              </div>
              <div class="flex items-center gap-2 mt-0.5 min-w-0 flex-1">
                <span class="truncate" :title="t.description">{{ t.description }}</span>
                <span v-if="t.statusTag === 'paid'" class="shrink-0 px-1.5 py-0.5 rounded bg-income/20 text-income text-[9px] font-bold uppercase tracking-wider">
                  Pago
                </span>
                <span v-else class="shrink-0 px-1.5 py-0.5 rounded bg-alert/20 text-alert text-[9px] font-bold uppercase tracking-wider">
                  Pendente
                </span>
              </div>
            </div>
            <div class="flex items-center justify-between mt-0.5 gap-2">
              <div class="flex items-center gap-1.5 min-w-0">
                <div v-if="t.categoryId && categoriesMap.get(t.categoryId)" class="w-1.5 h-1.5 rounded-full shrink-0" :style="{ backgroundColor: categoriesMap.get(t.categoryId)?.color || '#666' }"></div>
                <span class="text-[11px] text-muted truncate" :class="t.type === 'expense' ? 'text-expense/80' : 'text-income/80'">
                  <template v-if="t.categoryId && categoriesMap.get(t.categoryId)">
                    {{ categoriesMap.get(t.categoryId)?.name }} &bull;
                  </template>
                  Assinatura
                </span>
              </div>
              <span class="font-bold text-sm shrink-0" :class="t.type === 'expense' ? 'text-expense' : 'text-income'">
                {{ t.type === 'expense' && !t.amount.toString().startsWith('-') ? '-' : '' }}{{ brl(t.amount) }}
              </span>
            </div>
          </div>
          </div>
        </li>
      </template>
      </ul>
    </div>
  </div>
</template>
