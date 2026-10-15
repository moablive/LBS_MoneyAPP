import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { api } from '@moneyapp/api-client';
import type { CreateEmpresaInput, Empresa, EmpresaResumo, UpdateEmpresaInput } from '@moneyapp/models';

/**
 * Empresas do dono (Moab Corp, Astral Wave, Conselho Ômega…). Conta e
 * lançamento sem empresa = pessoal. Doc: "Projeto - MoneyAPP ／ Empresas e
 * agente financeiro" (pasta awldocs do Drive).
 */
export const useEmpresasStore = defineStore('empresas', () => {
  const items = ref<Empresa[]>([]);
  const carregado = ref(false);

  async function fetchEmpresas(force = false) {
    if (carregado.value && !force) return items.value;
    items.value = await api.get<Empresa[]>('/empresas');
    carregado.value = true;
    return items.value;
  }

  async function criar(data: CreateEmpresaInput) {
    const row = await api.post<Empresa>('/empresas', data);
    await fetchEmpresas(true);
    return row;
  }

  async function atualizar(id: string, data: UpdateEmpresaInput) {
    const row = await api.patch<Empresa>(`/empresas/${id}`, data);
    await fetchEmpresas(true);
    return row;
  }

  async function remover(id: string) {
    await api.delete<void>(`/empresas/${id}`);
    await fetchEmpresas(true);
  }

  function resumo(month: string) {
    return api.get<{ month: string; empresas: EmpresaResumo[] }>(`/empresas/resumo?month=${month}`);
  }

  const porId = computed(() => new Map(items.value.map((e) => [e.id, e])));
  const nomeDe = (id: string | null | undefined) => (id ? porId.value.get(id)?.nome ?? '—' : 'Pessoal');

  return { items, carregado, fetchEmpresas, criar, atualizar, remover, resumo, porId, nomeDe };
});
