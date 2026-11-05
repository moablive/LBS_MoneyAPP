<script setup lang="ts">
import { computed } from 'vue';
import type { LoanSummaryResponse, LoanItem } from '@moneyapp/models';

/**
 * Painel inicial dos Empréstimos (05/11/2026, pedido do dono): tudo junto numa tela só —
 * saldo líquido (quem me deve − o que eu devo), um cartão por grupo (A Receber, A Pagar,
 * FGTS, Pagos) e as listas lado a lado. O botão "+ Novo empréstimo" abre a pergunta
 * "O que você vai fazer?" do LoanModal.
 */
const props = defineProps<{
  data: LoanSummaryResponse | null;
  loading: boolean;
}>();

const emit = defineEmits<{
  (e: 'novo'): void;
  (e: 'abrir', item: LoanItem): void;
}>();

const brl = (n: number | string) =>
  Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Mesmo valor que a lista mostra: o esperado quando difere do emprestado. */
const valor = (it: LoanItem) => {
  const exp = (it as any).expectedAmount;
  return exp && Number(exp) !== Number(it.amount) ? Number(exp) : Number(it.amount);
};

const dia = (iso: string) => {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' }).replace('.', '');
};

const itens = computed(() => props.data?.items ?? []);
const ativos = (tipo: LoanItem['type']) =>
  itens.value.filter(i => i.status === 'active' && i.type === tipo).sort((a, b) => valor(b) - valor(a));

const meDevem = computed(() => ativos('given'));
const euDevo = computed(() => ativos('received'));
const fgts = computed(() => ativos('fgts'));
const pagos = computed(() =>
  itens.value.filter(i => i.status === 'paid').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
);

const aReceber = computed(() => props.data?.totalActiveAmountGiven ?? 0);
const aPagar = computed(() => props.data?.totalActiveAmountReceived ?? 0);
const totalFgts = computed(() => props.data?.totalActiveAmountFGTS ?? 0);
const totalPago = computed(() => pagos.value.reduce((s, i) => s + valor(i), 0));
const saldo = computed(() => aReceber.value - aPagar.value);
const parteReceber = computed(() => {
  const t = aReceber.value + aPagar.value;
  return t > 0 ? (aReceber.value / t) * 100 : 50;
});

const cartoes = computed(() => [
  { to: '/emprestimos/receber', rotulo: 'A Receber', sub: 'Quem me deve', valor: aReceber.value, n: meDevem.value.length, cor: 'text-income', fundo: 'bg-income/10', seta: 'up' },
  { to: '/emprestimos/pagar', rotulo: 'A Pagar', sub: 'O que eu devo', valor: aPagar.value, n: euDevo.value.length, cor: 'text-expense', fundo: 'bg-expense/10', seta: 'down' },
  { to: '/emprestimos/fgts', rotulo: 'FGTS', sub: 'Antecipações', valor: totalFgts.value, n: fgts.value.length, cor: 'text-blue-400', fundo: 'bg-blue-500/10', seta: 'fgts' },
  { to: '/emprestimos/pagos', rotulo: 'Pagos', sub: 'Já quitados', valor: totalPago.value, n: pagos.value.length, cor: 'text-muted', fundo: 'bg-surface-overlay', seta: 'ok' },
]);

const listas = computed(() => [
  { titulo: 'Quem me deve', to: '/emprestimos/receber', itens: meDevem.value, total: aReceber.value, cor: 'text-income', ponto: 'bg-income', vazio: 'Ninguém te deve agora.' },
  { titulo: 'O que eu devo', to: '/emprestimos/pagar', itens: euDevo.value, total: aPagar.value, cor: 'text-expense', ponto: 'bg-expense', vazio: 'Você não deve nada. 🎉' },
  ...(fgts.value.length
    ? [{ titulo: 'FGTS', to: '/emprestimos/fgts', itens: fgts.value, total: totalFgts.value, cor: 'text-blue-400', ponto: 'bg-blue-400', vazio: '' }]
    : []),
]);
</script>

<template>
  <div class="space-y-6">
    <!-- Cabeçalho + botão -->
    <header class="flex items-end justify-between gap-4 flex-wrap">
      <div>
        <h1 class="text-3xl font-bold tracking-tight font-display">Empréstimos</h1>
        <p class="text-sm text-muted">Quem me deve e quanto eu devo, tudo num lugar só.</p>
      </div>
      <button
        @click="emit('novo')"
        class="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-accent text-white font-semibold shadow-lg hover:bg-accent/90 active:scale-[.98] transition"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
        Novo empréstimo
      </button>
    </header>

    <!-- Saldo líquido -->
    <section class="card relative overflow-hidden animate-fade-in-up">
      <div class="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div class="text-[11px] uppercase tracking-wider text-muted font-semibold">Saldo dos empréstimos</div>
          <div v-if="loading" class="skeleton h-10 w-48 mt-2" />
          <div v-else class="text-4xl font-bold font-display tabular-nums mt-1" :class="saldo >= 0 ? 'text-income' : 'text-expense'">
            {{ saldo >= 0 ? '+' : '−' }} {{ brl(Math.abs(saldo)) }}
          </div>
          <p v-if="!loading" class="text-sm text-muted mt-1">
            {{ saldo > 0 ? 'Te devem mais do que você deve.' : saldo < 0 ? 'Você deve mais do que te devem.' : 'Está tudo empatado.' }}
          </p>
        </div>
        <div class="flex gap-6 text-right">
          <div>
            <div class="text-[10px] uppercase tracking-wide text-muted">A receber</div>
            <div class="font-semibold tabular-nums text-income">{{ brl(aReceber) }}</div>
          </div>
          <div>
            <div class="text-[10px] uppercase tracking-wide text-muted">A pagar</div>
            <div class="font-semibold tabular-nums text-expense">{{ brl(aPagar) }}</div>
          </div>
        </div>
      </div>
      <div class="mt-5">
        <div class="flex h-2.5 rounded-full overflow-hidden bg-surface-overlay">
          <div class="bg-income transition-all duration-700" :style="{ width: `${parteReceber}%` }" />
          <div class="bg-expense flex-1" />
        </div>
        <div class="flex justify-between text-[10px] text-muted mt-1">
          <span>Me devem</span><span>Eu devo</span>
        </div>
      </div>
    </section>

    <!-- Um cartão por grupo -->
    <section class="grid grid-cols-2 xl:grid-cols-4 gap-4">
      <RouterLink
        v-for="(c, i) in cartoes"
        :key="c.to"
        :to="c.to"
        class="kpi animate-fade-in-up hover:-translate-y-0.5 hover:shadow-lg transition"
        :style="{ animationDelay: `${(i + 1) * 70}ms` }"
      >
        <div class="kpi-head">
          <span class="kpi-label">{{ c.rotulo }}</span>
          <span class="h-8 w-8 rounded-xl flex items-center justify-center" :class="[c.fundo, c.cor]">
            <svg v-if="c.seta === 'up'" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>
            <svg v-else-if="c.seta === 'down'" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></svg>
            <svg v-else-if="c.seta === 'fgts'" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="12" x="2" y="6" rx="2" /><path d="M12 12h.01M17 12h.01M7 12h.01" /></svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
          </span>
        </div>
        <div v-if="loading" class="skeleton h-7 w-24" />
        <div v-else class="kpi-value" :class="c.cor === 'text-muted' ? '' : c.cor">{{ brl(c.valor) }}</div>
        <div v-if="!loading" class="kpi-sub">
          <span class="text-muted">{{ c.sub }} · {{ c.n }} {{ c.n === 1 ? 'empréstimo' : 'empréstimos' }}</span>
        </div>
      </RouterLink>
    </section>

    <!-- Listas lado a lado -->
    <section class="grid gap-4" :class="listas.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'">
      <div v-for="l in listas" :key="l.to" class="card !p-0 overflow-hidden flex flex-col">
        <div class="flex items-center justify-between px-4 py-3 border-b border-surface-border">
          <div class="flex items-center gap-2 font-semibold">
            <span class="h-2.5 w-2.5 rounded-full" :class="l.ponto" />
            {{ l.titulo }}
          </div>
          <span class="tabular-nums font-bold text-sm" :class="l.cor">{{ brl(l.total) }}</span>
        </div>
        <div v-if="loading" class="p-4 space-y-2">
          <div v-for="i in 3" :key="i" class="skeleton h-10 w-full rounded-xl" />
        </div>
        <ul v-else-if="l.itens.length" class="divide-y divide-surface-border/40">
          <li
            v-for="it in l.itens.slice(0, 6)"
            :key="it.id"
            class="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer hover:bg-surface-overlay/40 transition-colors"
            @click="emit('abrir', it)"
          >
            <div class="min-w-0">
              <div class="text-sm font-medium truncate">{{ it.description }}</div>
              <div class="text-[11px] text-muted">{{ dia(it.date) }}</div>
            </div>
            <span class="tabular-nums font-semibold text-sm shrink-0" :class="l.cor">{{ brl(valor(it)) }}</span>
          </li>
        </ul>
        <p v-else class="px-4 py-8 text-center text-sm text-muted">{{ l.vazio }}</p>
        <RouterLink
          v-if="l.itens.length > 6"
          :to="l.to"
          class="mt-auto px-4 py-2.5 text-xs font-semibold text-muted hover:text-fg border-t border-surface-border text-center"
        >Ver todos os {{ l.itens.length }} →</RouterLink>
      </div>
    </section>

    <!-- Quitados recentemente -->
    <section v-if="!loading && pagos.length" class="card !p-0 overflow-hidden">
      <div class="flex items-center justify-between px-4 py-3 border-b border-surface-border">
        <div class="font-semibold">Quitados recentemente</div>
        <RouterLink to="/emprestimos/pagos" class="text-xs font-semibold text-muted hover:text-fg">Ver todos →</RouterLink>
      </div>
      <ul class="divide-y divide-surface-border/40">
        <li
          v-for="it in pagos.slice(0, 5)"
          :key="it.id"
          class="flex items-center justify-between gap-3 px-4 py-2.5 cursor-pointer hover:bg-surface-overlay/40 transition-colors"
          @click="emit('abrir', it)"
        >
          <div class="flex items-center gap-2 min-w-0">
            <span class="h-2 w-2 rounded-full shrink-0" :class="it.type === 'given' ? 'bg-income' : it.type === 'received' ? 'bg-expense' : 'bg-blue-400'" />
            <span class="text-sm text-muted truncate">{{ it.description }}</span>
          </div>
          <span class="tabular-nums text-sm text-muted shrink-0">{{ brl(valor(it)) }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>
