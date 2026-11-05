<script setup lang="ts">
import { computed } from 'vue';

// Barra do limite LIVRE do cartão em três faixas (05/11/2026, pedido do dono): enche da esquerda
// conforme o que ainda dá para gastar — vermelho até 20% livre, amarelo de 20% a 50%, verde acima
// de 50%. Cartão zerado = barra cheia; cartão estourado = quase vazia, só no vermelho. O que já foi
// consumido fica na cor da faixa, apagado.
const props = defineProps<{ usado: number; limite: number; altura?: string }>();

const faixas = [
  { de: 0, ate: 20, cheio: 'bg-red-500', vazio: 'bg-red-500/25' },
  { de: 20, ate: 50, cheio: 'bg-amber-400', vazio: 'bg-amber-400/25' },
  { de: 50, ate: 100, cheio: 'bg-emerald-500', vazio: 'bg-emerald-500/25' },
];

const livre = computed(() => props.limite - Math.abs(props.usado));
const pct = computed(() => (props.limite > 0 ? Math.max(0, (livre.value / props.limite) * 100) : 0));
const preenchimento = (f: { de: number; ate: number }) =>
  Math.min(100, Math.max(0, ((pct.value - f.de) / (f.ate - f.de)) * 100));
const titulo = computed(() => {
  const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  return `${Math.round(pct.value)}% do limite livre · ${brl(livre.value)} de ${brl(props.limite)}`;
});
</script>

<template>
  <div class="flex gap-0.5 w-full" :class="altura ?? 'h-1.5'" :title="titulo" role="meter"
       :aria-valuenow="Math.round(pct)" aria-valuemin="0" aria-valuemax="100" :aria-label="titulo">
    <div
      v-for="f in faixas"
      :key="f.de"
      class="relative h-full overflow-hidden first:rounded-l-full last:rounded-r-full"
      :class="f.vazio"
      :style="{ width: `${f.ate - f.de}%` }"
    >
      <div class="absolute inset-y-0 left-0 transition-[width] duration-700 ease-smooth" :class="f.cheio" :style="{ width: `${preenchimento(f)}%` }" />
    </div>
  </div>
</template>
