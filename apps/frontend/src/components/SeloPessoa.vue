<script setup lang="ts">
import { computed } from 'vue';
import { useEmpresasStore } from '../stores/empresas';

// Selo PF/PJ da conta (05/11/2026, pedido do dono): conta ligada a uma empresa é PJ, sem empresa é PF (pessoal).
// `sobreCor`: versão branca para ir em cima de um cartão já pintado (Meus Cartões do painel).
const props = defineProps<{ empresaId?: string | null; sobreCor?: boolean }>();
const empresas = useEmpresasStore();
const pj = computed(() => Boolean(props.empresaId));
const titulo = computed(() => (pj.value ? `Pessoa jurídica — ${empresas.nomeDe(props.empresaId!)}` : 'Pessoa física (pessoal)'));
</script>

<template>
  <span
    :title="titulo"
    class="shrink-0 text-[9px] font-bold tracking-wider px-1.5 py-0.5 rounded-md border"
    :class="sobreCor
      ? (pj ? 'bg-white text-violet-700 border-white' : 'bg-white/90 text-sky-700 border-white/90')
      : (pj ? 'bg-violet-500/15 text-violet-600 border-violet-500/30 dark:text-violet-300' : 'bg-sky-500/10 text-sky-700 border-sky-500/25 dark:text-sky-300')"
  >{{ pj ? 'PJ' : 'PF' }}</span>
</template>
