<script setup lang="ts">
import { computed, onMounted } from 'vue';
import BarraLimite from '../BarraLimite.vue';
import SeloPessoa from '../SeloPessoa.vue';
import { useEmpresasStore } from '../../stores/empresas';
import { nivelLimite, type NivelLimite } from '../../utils/limite';

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

// Selo PF/PJ e nome da empresa no cartão (05/11/2026); o store só busca a lista uma vez.
const empresas = useEmpresasStore();
onMounted(() => { empresas.fetchEmpresas().catch(() => {}); });

const creditCards = computed(() => props.accounts.filter(a => a.type === 'credit_card'));

const brl = (n: number | string) =>
  Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Cor do cartão = nível do limite livre (05/11/2026, pedido do dono): verde com folga, amarelo
// passando da metade, vermelho com 20% ou menos livre. Sem limite cadastrado fica grafite.
// A barra vai em branco/preto sobre a cor do cartão, senão some no fundo da mesma cor.
type Paleta = { card: string; sub: string; track: string; deco: string; cheio: string; trilho: string };
const paletas: Record<NivelLimite | 'sem', Paleta> = {
  verde:    { card: 'bg-emerald-500 text-white', sub: 'text-white/75', track: 'bg-black/15', deco: 'bg-white/15', cheio: 'bg-white', trilho: 'bg-white/25' },
  amarelo:  { card: 'bg-amber-400 text-ink-950', sub: 'text-ink-950/65', track: 'bg-black/10', deco: 'bg-white/30', cheio: 'bg-ink-950', trilho: 'bg-ink-950/15' },
  vermelho: { card: 'bg-red-500 text-white', sub: 'text-white/80', track: 'bg-black/15', deco: 'bg-white/15', cheio: 'bg-white', trilho: 'bg-white/25' },
  sem:      { card: 'bg-[#1f2437] text-white', sub: 'text-white/60', track: 'bg-white/10', deco: 'bg-white/10', cheio: 'bg-lime', trilho: 'bg-white/15' },
};
const palette = (card: any) => paletas[nivelLimite(card.currentBalance, card.creditLimit) ?? 'sem'];

const usage = (card: any) => {
  const limit = Number(card.creditLimit);
  if (!limit || limit <= 0) return null;
  const used = Math.abs(Number(card.currentBalance));
  return { free: limit - used, limit };
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
        :class="palette(card).card"
        :style="{ animationDelay: `${(idx * 90) + 300}ms` }"
      >
        <!-- decoração de "plástico" -->
        <div class="absolute -right-8 -top-10 w-32 h-32 rounded-full pointer-events-none" :class="palette(card).deco"></div>
        <div class="absolute right-10 -bottom-14 w-28 h-28 rounded-full pointer-events-none opacity-60" :class="palette(card).deco"></div>

        <div class="relative flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex items-center gap-2 min-w-0">
              <p class="text-sm font-semibold truncate">{{ card.name }}</p>
              <SeloPessoa :empresa-id="card.empresaId" sobre-cor />
            </div>
            <p class="text-[10px] font-semibold uppercase tracking-wider truncate" :class="palette(card).sub">
              <template v-if="card.dueDay || card.closingDay">Vence dia {{ card.dueDay || card.closingDay }}</template>
              <template v-else>Cartão de crédito</template>
              <template v-if="card.empresaId"> · {{ empresas.nomeDe(card.empresaId) }}</template>
            </p>
          </div>
          <div class="w-9 h-9 rounded-lg bg-white/90 flex items-center justify-center shrink-0 shadow-sm">
            <img v-if="card.customIconUrl" :src="card.customIconUrl" class="w-6 h-6 rounded-sm object-contain" />
            <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111113" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
          </div>
        </div>

        <!-- Número grande = disponível para gastar (05/11/2026, pedido do dono); a fatura fica pequena ao lado.
             Sem limite cadastrado não há disponível: aí o grande continua sendo a fatura. -->
        <div v-if="usage(card)" class="relative mt-3 flex items-end justify-between gap-3">
          <div>
            <p class="text-[10px] font-semibold uppercase tracking-wider mb-1" :class="palette(card).sub">Disponível</p>
            <p class="text-2xl font-bold font-display tabular-nums tracking-tight leading-none">{{ brl(usage(card)!.free) }}</p>
          </div>
          <p class="text-[10px] font-semibold uppercase tracking-wider text-right" :class="palette(card).sub">
            Fatura {{ brl(Math.abs(Number(card.currentBalance))) }}
          </p>
        </div>
        <div v-else class="relative mt-3">
          <p class="text-[10px] font-semibold uppercase tracking-wider mb-1" :class="palette(card).sub">Fatura</p>
          <p class="text-2xl font-bold font-display tabular-nums tracking-tight leading-none">{{ brl(Math.abs(Number(card.currentBalance))) }}</p>
        </div>

        <!-- Moldura escura leve para a barra destacar sobre a cor do cartão. -->
        <div v-if="usage(card)" class="relative mt-3 rounded-full p-0.5" :class="palette(card).track">
          <BarraLimite :usado="Number(card.currentBalance)" :limite="usage(card)!.limit" :cheio="palette(card).cheio" :trilho="palette(card).trilho" />
        </div>
      </li>
    </ul>
  </div>
</template>
