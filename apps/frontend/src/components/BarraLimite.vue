<script setup lang="ts">
import { computed } from 'vue';
import { nivelLimite, pctLivre, type NivelLimite } from '../utils/limite';

// Barra do limite LIVRE do cartão (05/11/2026, pedido do dono): enche conforme o que ainda dá para
// gastar e a barra inteira toma a cor do nível — vermelho até 20% livre, amarelo até 50%, verde acima.
// `cheio`/`trilho` trocam as cores quando o próprio cartão já está pintado com o nível (painel).
const props = defineProps<{ usado: number; limite: number; altura?: string; cheio?: string; trilho?: string }>();

const cores: Record<NivelLimite, { cheio: string; trilho: string }> = {
  verde: { cheio: 'bg-emerald-500', trilho: 'bg-emerald-500/20' },
  amarelo: { cheio: 'bg-amber-400', trilho: 'bg-amber-400/25' },
  vermelho: { cheio: 'bg-red-500', trilho: 'bg-red-500/20' },
};

const pct = computed(() => pctLivre(props.usado, props.limite) ?? 0);
const cor = computed(() => cores[nivelLimite(props.usado, props.limite) ?? 'verde']);
const titulo = computed(() => {
  const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const livre = props.limite - Math.abs(props.usado);
  return `${Math.round(pct.value)}% do limite livre · ${brl(livre)} de ${brl(props.limite)}`;
});
</script>

<template>
  <div class="relative w-full rounded-full overflow-hidden" :class="[altura ?? 'h-1.5', trilho ?? cor.trilho]" :title="titulo"
       role="meter" :aria-valuenow="Math.round(pct)" aria-valuemin="0" aria-valuemax="100" :aria-label="titulo">
    <!-- Mínimo de 2% para o vermelho aparecer mesmo com quase nada livre. -->
    <div class="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-smooth" :class="cheio ?? cor.cheio"
         :style="{ width: `${pct > 0 ? Math.max(2, pct) : 0}%` }" />
  </div>
</template>
