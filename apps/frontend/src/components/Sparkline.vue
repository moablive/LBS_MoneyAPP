<script setup lang="ts">
import { computed } from 'vue';

/**
 * Linha suave em SVG puro para os cards de KPI (sem Chart.js: é só decoração
 * de tendência, com área degradê e ponto no último valor).
 */
const props = withDefaults(defineProps<{
  values: number[];
  color?: string;
  width?: number;
  height?: number;
  fill?: boolean;
}>(), { color: 'currentColor', width: 120, height: 40, fill: true });

const gradId = `sp-${Math.random().toString(36).slice(2, 8)}`;

const pts = computed<[number, number][]>(() => {
  const v = props.values;
  if (v.length < 2) return [];
  const min = Math.min(...v);
  const max = Math.max(...v);
  const span = max - min || 1;
  const pad = 3;
  const w = props.width - pad * 2;
  const h = props.height - pad * 2;
  return v.map((y, i) => [pad + (i / (v.length - 1)) * w, pad + (1 - (y - min) / span) * h]);
});

// Catmull-Rom → Bézier cúbica: curva passa pelos pontos sem "orelhas".
const path = computed(() => {
  const p = pts.value;
  if (!p.length) return '';
  const first = p[0]!;
  let d = `M${first[0].toFixed(1)},${first[1].toFixed(1)}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p1 = p[i]!;
    const p2 = p[i + 1]!;
    const p0 = p[i - 1] ?? p1;
    const p3 = p[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
});

const area = computed(() => {
  const p = pts.value;
  if (!path.value || !p.length) return '';
  const first = p[0]!;
  const end = p[p.length - 1]!;
  return `${path.value} L${end[0].toFixed(1)},${props.height} L${first[0].toFixed(1)},${props.height} Z`;
});

const last = computed(() => pts.value[pts.value.length - 1]);
</script>

<template>
  <svg
    :viewBox="`0 0 ${width} ${height}`"
    preserveAspectRatio="none"
    class="w-full h-full overflow-visible"
    aria-hidden="true"
  >
    <defs>
      <linearGradient :id="gradId" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" :stop-color="color" stop-opacity="0.35" />
        <stop offset="1" :stop-color="color" stop-opacity="0" />
      </linearGradient>
    </defs>
    <path v-if="fill && area" :d="area" :fill="`url(#${gradId})`" />
    <path
      v-if="path"
      :d="path"
      fill="none"
      :stroke="color"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      vector-effect="non-scaling-stroke"
      pathLength="1"
      class="animate-draw"
      style="stroke-dasharray: 1"
    />
    <circle v-if="last" :cx="last[0]" :cy="last[1]" r="2.5" :fill="color" />
  </svg>
</template>
