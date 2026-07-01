<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  upcomingTransactions: any[];
  categoriesMap: Map<string, any>;
  loading: boolean;
}>();

const emit = defineEmits<{
  (e: 'action', item: any): void;
  (e: 'pay', item: any): void;
  (e: 'dismiss', item: any): void;
  (e: 'dragstart', ev: DragEvent, item: any): void;
  (e: 'drop', ev: DragEvent): void;
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

const totalUpcoming = computed(() => {
  return props.upcomingTransactions.reduce((acc, t) => acc + Number(t.amount), 0);
});
</script>

<template>
  <div class="card flex flex-col animate-fade-in-up delay-400">
    <h2 class="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Visão de Controle</h2>
    
    <div class="flex items-start sm:items-center justify-between mb-6 flex-wrap gap-2">
      <div class="flex items-center gap-3">
        <h3 class="text-lg text-white font-medium font-display">Controle</h3>
      </div>
      <span v-if="!loading && upcomingTransactions.length > 0" class="text-sm font-bold text-expense font-display">
        Total: {{ brl(totalUpcoming) }}
      </span>
    </div>
    
    <div class="flex-1 flex flex-col min-h-[150px]"
         @dragover.prevent 
         @dragenter.prevent 
         @drop="(e) => emit('drop', e)">
      <div v-if="loading" class="space-y-4">
        <div v-for="i in 5" :key="i" class="skeleton h-12 w-full" />
      </div>
      <div v-else-if="upcomingTransactions.length === 0" class="flex-1 flex flex-col items-center justify-center py-8 border-2 border-dashed border-surface-border/50 rounded-xl">
        <span class="text-muted text-sm font-medium">Nenhum lançamento pendente.</span>
      </div>
      <ul v-else class="space-y-4 max-h-[500px] overflow-y-auto pr-4 custom-scrollbar">
      <template v-for="(t, idx) in upcomingTransactions" :key="t.id">
        <div v-if="idx === 0 || t.occurredAt.slice(0,7) !== upcomingTransactions[idx - 1].occurredAt.slice(0,7)" 
             class="flex items-center gap-3 opacity-60" :class="idx === 0 ? 'mb-2' : 'mt-4 mb-2'">
          <div class="h-px flex-1" :class="isCurrentMonth(t.occurredAt) ? 'bg-accent/50' : 'bg-surface-border'"></div>
          <span class="text-[10px] font-bold uppercase tracking-wider flex items-center gap-2"
                :class="isCurrentMonth(t.occurredAt) ? 'text-accent' : 'text-white'">
            {{ formatMonthSeparator(t.occurredAt) }}
            <span v-if="isCurrentMonth(t.occurredAt)" class="px-1.5 py-0.5 rounded-full bg-accent/20 text-accent text-[8px] leading-none">Hoje {{ new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) }}</span>
          </span>
          <div class="h-px flex-1" :class="isCurrentMonth(t.occurredAt) ? 'bg-accent/50' : 'bg-surface-border'"></div>
        </div>

        <li @click="emit('action', t)"
            draggable="true"
            @dragstart="(e) => emit('dragstart', e, t)"
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
                <svg v-if="t.isSubscription" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-accent shrink-0" title="Assinatura"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>
              </div>
            </div>
            <div class="flex items-center justify-between mt-0.5 gap-2">
              <div class="flex items-center gap-1.5 min-w-0">
                <div v-if="t.categoryId && categoriesMap.get(t.categoryId)" class="w-1.5 h-1.5 rounded-full shrink-0" :style="{ backgroundColor: categoriesMap.get(t.categoryId)?.color || '#666' }"></div>
                <span class="text-[11px] text-muted truncate" :class="t.type === 'expense' ? 'text-expense/80' : 'text-income/80'">
                  <template v-if="t.categoryId && categoriesMap.get(t.categoryId)">
                    {{ categoriesMap.get(t.categoryId)?.name }} &bull;
                  </template>
                  <template v-if="t.isLoan">
                    {{ t.loanType === 'received' ? 'Empréstimo a pagar' : t.loanType === 'fgts' ? 'FGTS a receber' : 'Empréstimo a receber' }}
                  </template>
                  <template v-else-if="t.isSubscription">
                    Assinatura
                  </template>
                  <template v-else-if="t.isCreditCard">
                    Fatura de Cartão
                  </template>
                  <template v-else>
                    {{ t.type === 'expense' ? 'Despesa' : 'Receita' }} pendente
                  </template>
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
