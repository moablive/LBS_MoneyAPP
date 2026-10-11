<script setup lang="ts">
import { computed } from 'vue';

// Injetadas pelo docker-compose como build-arg, a partir do APP_VERSION do .env
// (arquivo VERSION + scripts/bump-version.mjs).
const version = import.meta.env.VITE_APP_VERSION || '0.0.0';
const buildDate = import.meta.env.VITE_APP_BUILD_DATE || '';

const title = computed(() => {
  if (!buildDate) return `MoneyAPP v${version}`;
  const d = new Date(buildDate);
  const stamp = Number.isNaN(d.getTime())
    ? buildDate
    : d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  return `MoneyAPP v${version} — build de ${stamp}`;
});
</script>

<template>
  <span
    class="fixed bottom-[84px] right-3 sm:bottom-2 sm:right-2 z-[9999] select-none rounded-md bg-ink-950/80 px-2 py-0.5
           font-mono text-[11px] leading-none text-white/70 backdrop-blur-sm
           pointer-events-auto cursor-default"
    :title="title"
  >
    v{{ version }}
  </span>
</template>
