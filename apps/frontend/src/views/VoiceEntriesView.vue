<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue';
import { api } from '@moneyapp/api-client';
import AppShell from '../components/AppShell.vue';
import EmptyState from '../components/EmptyState.vue';
import { useConfirmDialog } from '../composables/useConfirmDialog';
import { nomeDaConta } from '../utils/conta';
import type { Account, Category } from '@moneyapp/models';

/**
 * Registro por voz (25/11/2026): contas ditas ao bot do Telegram. Ficam aqui, sem categoria
 * obrigatória e sem mexer no saldo, até serem confirmadas — aí viram lançamento no Livro Caixa.
 */
interface VoiceEntry {
  id: string;
  transcription: string;
  description: string;
  amount: string;
  type: 'expense' | 'income';
  occurredAt: string;
  suggestedCategoryId: string | null;
  suggestedAccountId: string | null;
  categoryId: string | null;
  accountId: string | null;
  empresaId: string | null;
  status: 'pending' | 'confirmed';
  createdAt: string;
}
interface Empresa { id: string; nome: string }

const { alert, confirm } = useConfirmDialog();

const items = shallowRef<VoiceEntry[]>([]);
const categories = ref<Category[]>([]);
const accounts = ref<Account[]>([]);
const empresas = ref<Empresa[]>([]);
const loading = ref(true);
const busy = ref<string | null>(null);
const selected = ref<Set<string>>(new Set());

const filtroStatus = ref<'pending' | 'confirmed' | 'all'>('pending');
const filtroTipo = ref<'' | 'expense' | 'income'>('');
const filtroCategoria = ref('');
const busca = ref('');
const de = ref('');
const ate = ref('');
const valorMin = ref('');
const valorMax = ref('');
const ordem = ref<'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'>('date_desc');

const ERROS: Record<string, string> = {
  categoria_obrigatoria: 'Escolha a categoria antes de confirmar.',
  categoria_de_outro_tipo: 'Essa categoria é de outro tipo (despesa/receita).',
  receipt_required_for_fatura_payment: 'Pagamento de fatura precisa de comprovante: lance pelo Livro Caixa.',
  ja_confirmado: 'Esse registro já foi confirmado.',
};
const msgErro = (e: unknown) => {
  const m = (e as Error)?.message ?? '';
  const codigo = Object.keys(ERROS).find((k) => m.includes(k));
  return (codigo && ERROS[codigo]) || 'Não consegui concluir. Tente de novo.';
};

function consulta(): string {
  const q = new URLSearchParams({ status: filtroStatus.value, sort: ordem.value, limit: '200' });
  if (filtroTipo.value) q.set('type', filtroTipo.value);
  if (filtroCategoria.value) q.set('categoria', filtroCategoria.value);
  if (busca.value.trim()) q.set('search', busca.value.trim());
  if (de.value) q.set('from', new Date(`${de.value}T00:00:00`).toISOString());
  if (ate.value) q.set('to', new Date(new Date(`${ate.value}T00:00:00`).getTime() + 86_400_000).toISOString());
  if (valorMin.value) q.set('min', valorMin.value);
  if (valorMax.value) q.set('max', valorMax.value);
  return q.toString();
}

async function reload() {
  loading.value = true;
  try {
    items.value = await api.get<VoiceEntry[]>(`/voice-entries?${consulta()}`);
    selected.value = new Set();
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  const [cats, accs, emps] = await Promise.all([
    api.get<Category[]>('/categories').catch(() => []),
    api.get<Account[]>('/accounts').catch(() => []),
    api.get<Empresa[]>('/empresas').catch(() => []),
  ]);
  categories.value = cats;
  accounts.value = accs;
  empresas.value = emps;
  await reload();
});

const brl = (v: string | number) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataLocal = (iso: string) => iso.slice(0, 10);
const quando = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
const catsDoTipo = (tipo: 'expense' | 'income') => categories.value.filter((c) => c.type === tipo);
const nomeCategoria = (id: string | null) => categories.value.find((c) => c.id === id)?.name ?? null;
const nomeConta = (id: string | null) => {
  const a = accounts.value.find((x) => x.id === id);
  return a ? nomeDaConta(a) : null;
};

const pendentes = computed(() => items.value.filter((i) => i.status === 'pending'));
const todosMarcados = computed(() => pendentes.value.length > 0 && pendentes.value.every((i) => selected.value.has(i.id)));
const totalPendente = computed(() => pendentes.value.reduce((s, i) => s + (i.type === 'expense' ? -1 : 1) * Number(i.amount), 0));

function alternar(id: string) {
  const s = new Set(selected.value);
  if (s.has(id)) s.delete(id); else s.add(id);
  selected.value = s;
}
function alternarTodos() {
  selected.value = todosMarcados.value ? new Set() : new Set(pendentes.value.map((i) => i.id));
}

function trocar(entry: VoiceEntry, novo: Partial<VoiceEntry>) {
  items.value = items.value.map((i) => (i.id === entry.id ? { ...i, ...novo } : i));
}

/** Grava a escolha na hora (categoria, conta, empresa, valor, descrição, data, tipo). */
async function salvarCampo(entry: VoiceEntry, campos: Record<string, unknown>) {
  busy.value = entry.id;
  try {
    const atualizado = await api.patch<VoiceEntry>(`/voice-entries/${entry.id}`, campos);
    trocar(entry, atualizado);
  } catch (e) {
    await alert(msgErro(e));
    await reload();
  } finally {
    busy.value = null;
  }
}

const campoTexto = (e: Event) => (e.target as HTMLInputElement).value;

function trocarCategoria(entry: VoiceEntry, e: Event) {
  salvarCampo(entry, { categoryId: campoTexto(e) || null });
}
function trocarConta(entry: VoiceEntry, e: Event) {
  salvarCampo(entry, { accountId: campoTexto(e) || null });
}
function trocarEmpresa(entry: VoiceEntry, e: Event) {
  salvarCampo(entry, { empresaId: campoTexto(e) || null });
}
function trocarValor(entry: VoiceEntry, e: Event) {
  const v = Number(campoTexto(e).replace(',', '.'));
  if (!Number.isFinite(v) || v <= 0) return reload();
  salvarCampo(entry, { amount: v });
}
function trocarDescricao(entry: VoiceEntry, e: Event) {
  const v = campoTexto(e).trim();
  if (!v) return reload();
  salvarCampo(entry, { description: v });
}
function trocarData(entry: VoiceEntry, e: Event) {
  const v = campoTexto(e);
  if (v) salvarCampo(entry, { occurredAt: new Date(`${v}T12:00:00`).toISOString() });
}
function trocarTipo(entry: VoiceEntry) {
  salvarCampo(entry, { type: entry.type === 'expense' ? 'income' : 'expense' });
}

/** Usa a sugestão da IA como escolha (um clique). */
function aceitarSugestao(entry: VoiceEntry) {
  const campos: Record<string, unknown> = {};
  if (!entry.categoryId && entry.suggestedCategoryId) campos.categoryId = entry.suggestedCategoryId;
  if (!entry.accountId && entry.suggestedAccountId) campos.accountId = entry.suggestedAccountId;
  if (Object.keys(campos).length) salvarCampo(entry, campos);
}
/** O que a IA sugeriu e o dono ainda não escolheu, em texto ("Mercado · PicPay · PF"). */
const textoSugestao = (e: VoiceEntry) =>
  [
    !e.categoryId ? nomeCategoria(e.suggestedCategoryId) : null,
    !e.accountId ? nomeConta(e.suggestedAccountId) : null,
  ].filter(Boolean).join(' · ');

async function confirmar(entry: VoiceEntry) {
  busy.value = entry.id;
  try {
    await api.post(`/voice-entries/${entry.id}/confirm`, {});
    await reload();
  } catch (e) {
    await alert(msgErro(e));
  } finally {
    busy.value = null;
  }
}

async function confirmarSelecionados() {
  const ids = [...selected.value];
  if (!ids.length) return;
  busy.value = 'lote';
  try {
    const r = await api.post<{ confirmed: string[]; skipped: { id: string; error: string }[] }>('/voice-entries/confirm-batch', { ids });
    if (r.skipped.length) {
      const sem = r.skipped.filter((s) => s.error === 'categoria_obrigatoria').length;
      await alert(
        `${r.confirmed.length} confirmado(s). ${r.skipped.length} ficou(aram) pendente(s)` +
          (sem ? `: ${sem} sem categoria.` : '.'),
      );
    }
    await reload();
  } finally {
    busy.value = null;
  }
}

async function descartar(entry: VoiceEntry) {
  if (!(await confirm(`Descartar "${entry.description}"? O registro será apagado.`))) return;
  busy.value = entry.id;
  try {
    await api.delete(`/voice-entries/${entry.id}`);
    await reload();
  } catch (e) {
    await alert(msgErro(e));
  } finally {
    busy.value = null;
  }
}

async function descartarSelecionados() {
  const ids = [...selected.value];
  if (!ids.length || !(await confirm(`Descartar ${ids.length} registro(s)?`))) return;
  busy.value = 'lote';
  try {
    await Promise.all(ids.map((id) => api.delete(`/voice-entries/${id}`)));
    await reload();
  } finally {
    busy.value = null;
  }
}

const campo = 'w-full bg-surface-overlay border border-surface-border rounded-lg px-2.5 py-1.5 text-sm text-fg focus:outline-none focus:ring-2 focus:ring-accent/60';
</script>

<template>
  <AppShell>
    <div class="mx-auto max-w-6xl px-6 py-8 relative z-10">
      <header class="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <h1 class="text-3xl font-bold tracking-tight text-fg mb-1">Registro por voz</h1>
          <p class="text-sm text-zinc-400">
            Contas que você falou no bot do Telegram. Ainda não entraram no saldo: categorize e confirme.
          </p>
        </div>
        <div v-if="filtroStatus !== 'confirmed' && pendentes.length" class="text-sm text-zinc-400">
          {{ pendentes.length }} pendente(s) · saldo da lista
          <span :class="totalPendente < 0 ? 'text-expense' : 'text-income'" class="font-semibold">{{ brl(totalPendente) }}</span>
        </div>
      </header>

      <!-- Filtros -->
      <div class="glass-card rounded-2xl p-4 mb-5 grid grid-cols-2 md:grid-cols-4 gap-3">
        <select v-model="filtroStatus" :class="campo" @change="reload">
          <option value="pending">Pendentes</option>
          <option value="confirmed">Confirmados</option>
          <option value="all">Todos</option>
        </select>
        <select v-model="filtroTipo" :class="campo" @change="reload">
          <option value="">Despesas e receitas</option>
          <option value="expense">Só despesas</option>
          <option value="income">Só receitas</option>
        </select>
        <select v-model="filtroCategoria" :class="campo" @change="reload">
          <option value="">Qualquer categoria</option>
          <option value="sem">Sem categoria</option>
          <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
        <select v-model="ordem" :class="campo" @change="reload">
          <option value="date_desc">Mais recentes</option>
          <option value="date_asc">Mais antigos</option>
          <option value="amount_desc">Maior valor</option>
          <option value="amount_asc">Menor valor</option>
        </select>
        <input v-model="busca" :class="[campo, 'col-span-2']" placeholder="Buscar no que foi dito…" @keyup.enter="reload" />
        <input v-model="de" type="date" :class="campo" title="De" @change="reload" />
        <input v-model="ate" type="date" :class="campo" title="Até" @change="reload" />
        <input v-model="valorMin" type="number" min="0" step="0.01" :class="campo" placeholder="Valor mínimo" @change="reload" />
        <input v-model="valorMax" type="number" min="0" step="0.01" :class="campo" placeholder="Valor máximo" @change="reload" />
      </div>

      <!-- Ações em lote -->
      <div v-if="filtroStatus !== 'confirmed' && pendentes.length" class="flex flex-wrap items-center gap-3 mb-3">
        <label class="inline-flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
          <input type="checkbox" :checked="todosMarcados" @change="alternarTodos" /> Selecionar todos
        </label>
        <template v-if="selected.size">
          <button
            class="px-3 py-1.5 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-50"
            :disabled="busy === 'lote'"
            @click="confirmarSelecionados"
          >Confirmar {{ selected.size }} selecionado(s)</button>
          <button
            class="px-3 py-1.5 rounded-lg text-red-400 hover:bg-red-400/10 text-sm font-medium disabled:opacity-50"
            :disabled="busy === 'lote'"
            @click="descartarSelecionados"
          >Descartar</button>
        </template>
      </div>

      <div v-if="loading" class="space-y-3">
        <div v-for="n in 3" :key="n" class="animate-pulse bg-surface-border h-28 rounded-2xl"></div>
      </div>

      <EmptyState
        v-else-if="!items.length"
        title="Nada por aqui"
        description="Mande um áudio ao bot do MoneyAPP no Telegram, por exemplo “gastei 150 no mercado”, e ele aparece aqui."
      />

      <ul v-else class="space-y-3">
        <li v-for="e in items" :key="e.id" class="glass-card rounded-2xl p-4" :class="{ 'opacity-60': busy === e.id }">
          <div class="flex items-start gap-3">
            <input
              v-if="e.status === 'pending'"
              type="checkbox"
              class="mt-1.5"
              :checked="selected.has(e.id)"
              @change="alternar(e.id)"
            />
            <div class="flex-1 min-w-0">
              <div class="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <input
                  :value="e.description"
                  :disabled="e.status !== 'pending'"
                  :class="[campo, 'sm:col-span-5 font-medium']"
                  @change="trocarDescricao(e, $event)"
                />
                <div class="sm:col-span-3 flex items-center gap-2">
                  <button
                    class="shrink-0 text-xs px-2 py-1 rounded-md border"
                    :class="e.type === 'expense' ? 'border-expense/40 text-expense' : 'border-income/40 text-income'"
                    :disabled="e.status !== 'pending'"
                    title="Trocar entre despesa e receita"
                    @click="trocarTipo(e)"
                  >{{ e.type === 'expense' ? 'Despesa' : 'Receita' }}</button>
                  <input
                    :value="Number(e.amount).toFixed(2)"
                    :disabled="e.status !== 'pending'"
                    type="number" min="0.01" step="0.01"
                    :class="campo"
                    @change="trocarValor(e, $event)"
                  />
                </div>
                <input
                  :value="dataLocal(e.occurredAt)"
                  :disabled="e.status !== 'pending'"
                  type="date"
                  :class="[campo, 'sm:col-span-2']"
                  @change="trocarData(e, $event)"
                />
                <div class="sm:col-span-2 flex justify-end gap-2">
                  <template v-if="e.status === 'pending'">
                    <button
                      class="px-3 py-1.5 rounded-lg bg-accent text-white text-sm font-medium disabled:opacity-50"
                      :disabled="busy === e.id || !e.categoryId"
                      :title="e.categoryId ? 'Lançar no Livro Caixa' : 'Escolha a categoria primeiro'"
                      @click="confirmar(e)"
                    >Confirmar</button>
                    <button class="px-2 py-1.5 rounded-lg text-red-400 hover:bg-red-400/10 text-sm" title="Descartar" @click="descartar(e)">✕</button>
                  </template>
                  <span v-else class="text-xs text-income self-center">✔ Lançado</span>
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                <select :value="e.categoryId ?? ''" :disabled="e.status !== 'pending'" :class="campo" @change="trocarCategoria(e, $event)">
                  <option value="">Categoria…</option>
                  <option v-for="c in catsDoTipo(e.type)" :key="c.id" :value="c.id">{{ c.name }}</option>
                </select>
                <select :value="e.accountId ?? ''" :disabled="e.status !== 'pending'" :class="campo" @change="trocarConta(e, $event)">
                  <option value="">Conta (opcional)…</option>
                  <option v-for="a in accounts" :key="a.id" :value="a.id">{{ nomeDaConta(a) }}</option>
                </select>
                <select :value="e.empresaId ?? ''" :disabled="e.status !== 'pending'" :class="campo" @change="trocarEmpresa(e, $event)">
                  <option value="">Empresa: a da conta / pessoal</option>
                  <option v-for="emp in empresas" :key="emp.id" :value="emp.id">{{ emp.nome }}</option>
                </select>
              </div>

              <p class="mt-2 text-xs text-zinc-500">
                🗣️ “{{ e.transcription }}” · {{ quando(e.createdAt) }}
                <button
                  v-if="e.status === 'pending' && textoSugestao(e)"
                  class="ml-2 text-accent hover:underline"
                  @click="aceitarSugestao(e)"
                >Usar sugestão da IA ({{ textoSugestao(e) }})</button>
              </p>
            </div>
          </div>
        </li>
      </ul>
    </div>
  </AppShell>
</template>
