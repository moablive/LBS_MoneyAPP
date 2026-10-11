<script setup lang="ts">
import { computed } from 'vue';

/**
 * Cartões como "cartões físicos" empilhados (lima, preto, grafite, índigo),
 * no espírito da tela Cards & Wallet da referência V5. Clique abre as opções
 * (pagar fatura, vincular, editar) como antes.
 */
const props = defineProps<{
  accounts: any[];
  loading: boolean;
}>();

const emit = defineEmits<{
  (e: 'action', account: any): void;
}>();

const creditCards = computed(() => props.accounts.filter(a => a.type === 'credit_card'));

const brl = (n: number | string) =>
  Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const palettes = [
  { card: 'bg-lime text-ink-950', sub: 'text-ink-950/60', bar: 'bg-ink-950', track: 'bg-ink-950/15', deco: 'bg-white/30' },
  { card: 'bg-ink-950 text-white', sub: 'text-white/60', bar: 'bg-lime', track: 'bg-white/15', deco: 'bg-white/10' },
  { card: 'bg-[#1f2437] text-white', sub: 'text-white/60', bar: 'bg-lime', track: 'bg-white/15', deco: 'bg-white/10' },
  { card: 'bg-primary text-white', sub: 'text-white/70', bar: 'bg-lime', track: 'bg-white/20', deco: 'bg-white/15' },
];
const palette = (i: number) => palettes[i % palettes.length]!;

const usage = (card: any) => {
  const limit = Number(card.creditLimit);
  if (!limit || limit <= 0) return null;
  const used = Math.abs(Number(card.currentBalance));
  return { pct: Math.min(100, Math.max(0, (used / limit) * 100)), free: limit - used, limit };
};
</script>

<template>
  <div class="card flex flex-col animate-fade-in-up delay-200">
    <h2 class="text-xs font-semibold text-muted uppercase tracking-wider mb-1">Faturas</h2>
    <h3 class="text-lg text-fg font-semibold mb-5 font-display">Meus Cartões</h3>

    <div v-if="loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="skeleton h-28 w-full rounded-2xl" />
    </div>
    <div v-else-if="creditCards.length === 0" class="flex-1 flex flex-col items-center justify-center text-center text-muted py-6">
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="mb-3 opacity-30"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
      <span class="text-sm">Nenhum cartão.</span>
    </div>
    <ul v-else class="space-y-3 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
      <li
        v-for="(card, idx) in creditCards"
        :key="card.id"
        @click="emit('action', card)"
        class="relative overflow-hidden rounded-2xl p-4 min-h-[112px] flex flex-col justify-between cursor-pointer
               shadow-lg shadow-black/10 hover:-translate-y-0.5 hover:shadow-xl transition-all duration-300 ease-smooth animate-fade-in-up"
        :class="palette(idx).card"
        :style="{ animationDelay: `${(idx * 90) + 300}ms` }"
      >
        <!-- decoração de "plástico" -->
        <div class="absolute -right-8 -top-10 w-32 h-32 rounded-full pointer-events-none" :class="palette(idx).deco"></div>
        <div class="absolute right-10 -bottom-14 w-28 h-28 rounded-full pointer-events-none opacity-60" :class="palette(idx).deco"></div>

        <div class="relative flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-semibold truncate">{{ card.name }}</p>
            <p class="text-[10px] font-semibold uppercase tracking-wider" :class="palette(idx).sub">
              <template v-if="card.dueDay || card.closingDay">Vence dia {{ card.dueDay || card.closingDay }}</template>
              <template v-else>Cartão de crédito</template>
            </p>
          </div>
          <div class="w-9 h-9 rounded-lg bg-white/90 flex items-center justify-center shrink-0 shadow-sm">
            <img v-if="card.customIconUrl" :src="card.customIconUrl" class="w-6 h-6 rounded-sm object-contain" />
            <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111113" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
          </div>
        </div>

        <div class="relative mt-3 flex items-end justify-between gap-3">
          <p class="text-2xl font-bold font-display tabular-nums tracking-tight leading-none">
            {{ brl(Math.abs(Number(card.currentBalance))) }}
          </p>
          <p v-if="usage(card)" class="text-[10px] font-semibold uppercase tracking-wider text-right" :class="palette(idx).sub">
            Livre {{ brl(usage(card)!.free) }}
          </p>
        </div>

        <div v-if="usage(card)" class="relative mt-3 h-1.5 rounded-full overflow-hidden" :class="palette(idx).track">
          <div class="h-full rounded-full transition-[width] duration-700 ease-smooth" :class="palette(idx).bar" :style="{ width: `${usage(card)!.pct}%` }" />
        </div>
      </li>
    </ul>
  </div>
</template>
