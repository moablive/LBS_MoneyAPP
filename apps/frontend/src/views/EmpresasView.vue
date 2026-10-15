<script setup lang="ts">
import { computed, onMounted, ref, useId, watch } from 'vue';
import type { Empresa, EmpresaResumo } from '@moneyapp/models';
import AppShell from '../components/AppShell.vue';
import Modal from '../components/modals/Modal.vue';
import { useConfirmDialog } from '../composables/useConfirmDialog';
import { useEmpresasStore } from '../stores/empresas';

/**
 * Empresas do dono (Moab Corp, Astral Wave, Conselho Ômega…): resumo do mês
 * por empresa e cadastro. A holding mostra também o consolidado (ela + filhas).
 * Doc: "Projeto - MoneyAPP ／ Empresas e agente financeiro" (pasta awldocs do Drive).
 */
const { confirm } = useConfirmDialog();
const store = useEmpresasStore();
const formId = useId();

const mesAtual = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 7);
const month = ref(mesAtual());
const linhas = ref<EmpresaResumo[]>([]);
const loading = ref(true);
const erro = ref<string | null>(null);

async function reload() {
  loading.value = true;
  erro.value = null;
  try {
    const [, res] = await Promise.all([store.fetchEmpresas(true), store.resumo(month.value)]);
    linhas.value = res.empresas;
  } catch {
    erro.value = 'Não foi possível carregar o resumo das empresas.';
  } finally {
    loading.value = false;
  }
}
onMounted(reload);
watch(month, reload);

function mudarMes(delta: number) {
  const [y, m] = month.value.split('-').map(Number);
  const d = new Date(Date.UTC(y!, m! - 1 + delta, 1));
  month.value = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
const mesLabel = computed(() => {
  const [y, m] = month.value.split('-').map(Number);
  return new Date(y!, m! - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
});

const brl = (n: number | string) => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Todas as descendentes de uma empresa (filhas, netas…). */
function descendentes(id: string): string[] {
  const filhas = store.items.filter((e) => e.parentId === id).map((e) => e.id);
  return filhas.flatMap((f) => [f, ...descendentes(f)]);
}

type Cartao = EmpresaResumo & { cor: string | null; maeNome: string | null; consolidado: EmpresaResumo | null };

const CAMPOS = ['receitas', 'despesas', 'resultado', 'pendentesReceber', 'pendentesPagar', 'saldoContas'] as const;

const cartoes = computed<Cartao[]>(() =>
  linhas.value.map((l) => {
    const emp = l.empresaId ? store.porId.get(l.empresaId) : undefined;
    let consolidado: EmpresaResumo | null = null;
    if (l.empresaId) {
      const ids = descendentes(l.empresaId);
      if (ids.length > 0) {
        const grupo = linhas.value.filter((x) => x.empresaId === l.empresaId || (x.empresaId && ids.includes(x.empresaId)));
        consolidado = { ...l, qtdPendentes: 0, qtdContas: 0 };
        for (const c of CAMPOS) consolidado[c] = grupo.reduce((acc, x) => acc + Number(x[c]), 0).toFixed(2);
        consolidado.qtdPendentes = grupo.reduce((acc, x) => acc + x.qtdPendentes, 0);
        consolidado.qtdContas = grupo.reduce((acc, x) => acc + x.qtdContas, 0);
      }
    }
    return {
      ...l,
      cor: emp?.cor ?? null,
      maeNome: emp?.parentId ? store.nomeDe(emp.parentId) : null,
      consolidado,
    };
  }),
);

// ---------- cadastro ----------
const showForm = ref(false);
const editando = ref<Empresa | null>(null);
const nome = ref('');
const cnpj = ref('');
const cor = ref('#a3e635');
const parentId = ref<string | null>(null);
const salvando = ref(false);
const erroForm = ref<string | null>(null);

const maesPossiveis = computed(() => {
  if (!editando.value) return store.items;
  const proibidas = new Set([editando.value.id, ...descendentes(editando.value.id)]);
  return store.items.filter((e) => !proibidas.has(e.id));
});

function abrirNova() {
  editando.value = null;
  nome.value = '';
  cnpj.value = '';
  cor.value = '#a3e635';
  parentId.value = null;
  erroForm.value = null;
  showForm.value = true;
}
function abrirEdicao(id: string | null) {
  const e = id ? store.porId.get(id) : undefined;
  if (!e) return;
  editando.value = e;
  nome.value = e.nome;
  cnpj.value = e.cnpj ?? '';
  cor.value = e.cor ?? '#a3e635';
  parentId.value = e.parentId;
  erroForm.value = null;
  showForm.value = true;
}

async function salvar() {
  if (!nome.value.trim()) {
    erroForm.value = 'Dê um nome para a empresa.';
    return;
  }
  salvando.value = true;
  erroForm.value = null;
  const payload = {
    nome: nome.value.trim(),
    cnpj: cnpj.value.trim() || null,
    cor: cor.value || null,
    parentId: parentId.value,
  };
  try {
    if (editando.value) await store.atualizar(editando.value.id, payload);
    else await store.criar(payload);
    showForm.value = false;
    await reload();
  } catch (err: any) {
    const codigo = err?.body?.error;
    erroForm.value =
      codigo === 'empresa_ja_existe' ? 'Já existe uma empresa com esse nome.'
      : codigo === 'empresa_mae_invalida' ? 'Essa empresa-mãe não pode ser usada.'
      : 'Não foi possível salvar a empresa.';
  } finally {
    salvando.value = false;
  }
}

async function excluir() {
  const e = editando.value;
  if (!e) return;
  const ok = await confirm(
    `Excluir "${e.nome}"? As contas e os lançamentos dela voltam a ser pessoais, e as empresas filhas ficam sem empresa-mãe. Nenhum lançamento é apagado.`,
  );
  if (!ok) return;
  await store.remover(e.id);
  showForm.value = false;
  await reload();
}
</script>

<template>
  <AppShell>
    <div class="mx-auto max-w-7xl px-6 py-8 space-y-6">
      <header class="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight">Empresas</h1>
          <p class="text-sm text-muted">Finanças separadas por empresa. O que não tem empresa é pessoal.</p>
        </div>
        <div class="flex items-center gap-2">
          <div class="flex items-center gap-1 rounded-xl border border-surface-border bg-surface-raised px-1 py-1">
            <button class="px-2 py-1 rounded-lg text-muted hover:text-fg" title="Mês anterior" @click="mudarMes(-1)">‹</button>
            <span class="text-sm font-medium text-fg capitalize min-w-[9rem] text-center">{{ mesLabel }}</span>
            <button class="px-2 py-1 rounded-lg text-muted hover:text-fg" title="Próximo mês" @click="mudarMes(1)">›</button>
          </div>
          <button class="btn-primary" @click="abrirNova">+ Nova Empresa</button>
        </div>
      </header>

      <p v-if="erro" class="card text-sm text-expense">{{ erro }}</p>

      <section v-if="loading" class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div v-for="i in 3" :key="i" class="skeleton h-48 w-full" />
      </section>

      <section v-else class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <article
          v-for="c in cartoes"
          :key="c.empresaId ?? 'pessoal'"
          class="bg-surface-raised border border-surface-border rounded-2xl p-4 space-y-3"
          :class="c.empresaId ? 'cursor-pointer hover:bg-surface-overlay/50 transition-colors' : ''"
          @click="abrirEdicao(c.empresaId)"
        >
          <div class="flex items-center gap-2 min-w-0">
            <span class="h-3 w-3 rounded-full shrink-0 border border-surface-border" :style="{ background: c.cor ?? 'transparent' }" />
            <h2 class="font-semibold text-fg truncate">{{ c.nome }}</h2>
            <span v-if="c.maeNome" class="text-[10px] uppercase tracking-wide text-muted truncate">de {{ c.maeNome }}</span>
            <span v-if="c.qtdPendentes > 0" class="ml-auto shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-lime/20 text-fg">
              {{ c.qtdPendentes }} pendente{{ c.qtdPendentes === 1 ? '' : 's' }}
            </span>
          </div>

          <dl class="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
            <div><dt class="text-[11px] uppercase tracking-wide text-muted">Receitas</dt><dd class="font-semibold tabular-nums text-income">{{ brl(c.receitas) }}</dd></div>
            <div><dt class="text-[11px] uppercase tracking-wide text-muted">Despesas</dt><dd class="font-semibold tabular-nums text-expense">{{ brl(Math.abs(Number(c.despesas))) }}</dd></div>
            <div><dt class="text-[11px] uppercase tracking-wide text-muted">Resultado</dt><dd class="font-semibold tabular-nums" :class="Number(c.resultado) < 0 ? 'text-expense' : 'text-fg'">{{ brl(c.resultado) }}</dd></div>
            <div><dt class="text-[11px] uppercase tracking-wide text-muted">Saldo das contas</dt><dd class="font-semibold tabular-nums text-fg">{{ brl(c.saldoContas) }}</dd></div>
            <div><dt class="text-[11px] uppercase tracking-wide text-muted">A receber</dt><dd class="tabular-nums text-fg">{{ brl(c.pendentesReceber) }}</dd></div>
            <div><dt class="text-[11px] uppercase tracking-wide text-muted">A pagar</dt><dd class="tabular-nums text-fg">{{ brl(Math.abs(Number(c.pendentesPagar))) }}</dd></div>
          </dl>

          <div v-if="c.consolidado" class="rounded-xl bg-surface-overlay border border-surface-border p-3 space-y-1">
            <div class="text-[11px] uppercase tracking-wide text-muted">Consolidado do grupo</div>
            <div class="flex justify-between text-sm"><span class="text-muted">Resultado</span><span class="font-semibold tabular-nums" :class="Number(c.consolidado.resultado) < 0 ? 'text-expense' : 'text-fg'">{{ brl(c.consolidado.resultado) }}</span></div>
            <div class="flex justify-between text-sm"><span class="text-muted">Saldo das contas</span><span class="font-semibold tabular-nums text-fg">{{ brl(c.consolidado.saldoContas) }}</span></div>
            <div class="flex justify-between text-sm"><span class="text-muted">A pagar / a receber</span><span class="tabular-nums text-fg">{{ brl(Math.abs(Number(c.consolidado.pendentesPagar))) }} / {{ brl(c.consolidado.pendentesReceber) }}</span></div>
          </div>

          <p class="text-[11px] text-muted">{{ c.qtdContas }} {{ c.qtdContas === 1 ? 'conta' : 'contas' }}</p>
        </article>
      </section>

      <p v-if="!loading && store.items.length === 0" class="text-sm text-muted">
        Nenhuma empresa ainda. Crie a primeira e depois escolha a empresa em cada conta (Contas › Modificar).
      </p>
    </div>

    <Modal :open="showForm" :title="editando ? 'Editar Empresa' : 'Nova Empresa'" @close="showForm = false">
      <form class="space-y-4" @submit.prevent="salvar">
        <label :for="formId + '-nome'" class="block space-y-1">
          <span class="text-xs uppercase tracking-wide text-muted">Nome</span>
          <input :id="formId + '-nome'" v-model="nome" required maxlength="120"
                 class="w-full bg-surface-overlay border border-surface-border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/60" />
        </label>
        <div class="grid grid-cols-2 gap-3">
          <label :for="formId + '-cnpj'" class="block space-y-1">
            <span class="text-xs uppercase tracking-wide text-muted">CNPJ (opcional)</span>
            <input :id="formId + '-cnpj'" v-model="cnpj" maxlength="18" placeholder="00.000.000/0000-00"
                   class="w-full bg-surface-overlay border border-surface-border rounded-xl px-3 py-2 tabular-nums focus:outline-none focus:ring-2 focus:ring-accent/60" />
          </label>
          <label :for="formId + '-cor'" class="block space-y-1">
            <span class="text-xs uppercase tracking-wide text-muted">Cor</span>
            <input :id="formId + '-cor'" v-model="cor" type="color"
                   class="w-full h-[42px] bg-surface-overlay border border-surface-border rounded-xl px-1 py-1" />
          </label>
        </div>
        <label :for="formId + '-mae'" class="block space-y-1">
          <span class="text-xs uppercase tracking-wide text-muted">Empresa-mãe (grupo)</span>
          <select :id="formId + '-mae'" v-model="parentId"
                  class="w-full bg-surface-overlay border border-surface-border rounded-xl px-3 py-2">
            <option :value="null">— nenhuma —</option>
            <option v-for="e in maesPossiveis" :key="e.id" :value="e.id">{{ e.nome }}</option>
          </select>
        </label>

        <p v-if="erroForm" class="text-sm text-expense">{{ erroForm }}</p>

        <div class="flex items-center justify-between gap-2 pt-2">
          <button v-if="editando" type="button" class="px-3 py-2 rounded-xl text-sm text-expense hover:bg-expense/10" @click="excluir">Excluir</button>
          <span v-else />
          <div class="flex gap-2">
            <button type="button" class="px-3 py-2 rounded-xl text-sm text-muted hover:text-fg" @click="showForm = false">Cancelar</button>
            <button type="submit" :disabled="salvando" class="btn-primary">
              {{ salvando ? 'Salvando…' : 'Salvar' }}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  </AppShell>
</template>
