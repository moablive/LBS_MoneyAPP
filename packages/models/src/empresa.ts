import { z } from 'zod';

// Empresa do dono. Conta e lançamento sem empresa = pessoal.
export const createEmpresaSchema = z
  .object({
    nome: z.string().trim().min(1).max(120),
    cnpj: z.string().trim().max(18).nullish(),
    cor: z.string().trim().regex(/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/u).nullish(),
    parentId: z.string().uuid().nullish(),
  })
  .strict();
export type CreateEmpresaInput = z.infer<typeof createEmpresaSchema>;

export const updateEmpresaSchema = createEmpresaSchema.partial();
export type UpdateEmpresaInput = z.infer<typeof updateEmpresaSchema>;

// Filtro por empresa nas listas: o id de uma empresa ou `pessoal` (sem empresa).
export const empresaFiltroSchema = z.union([z.string().uuid(), z.literal('pessoal')]);

export interface Empresa {
  id: string;
  nome: string;
  cnpj: string | null;
  cor: string | null;
  parentId: string | null;
  createdAt?: string;
}

/** Linha do resumo do mês por empresa (`GET /empresas/resumo`). */
export interface EmpresaResumo {
  empresaId: string | null; // null = pessoal
  nome: string;
  parentId: string | null;
  receitas: string;
  despesas: string;
  resultado: string;
  pendentesReceber: string;
  pendentesPagar: string;
  qtdPendentes: number;
  saldoContas: string;
  qtdContas: number;
}
