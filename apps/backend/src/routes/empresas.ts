import { Router } from 'express';
import { and, asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { createEmpresaSchema, monthStringSchema, updateEmpresaSchema } from '@moneyapp/models';
import type { EmpresaResumo } from '@moneyapp/models';
import { db, schema } from '@moneyapp/db';
const { empresas } = schema;
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { monthBounds } from './transactions.js';

/**
 * Empresas do dono (Moab Corp, Astral Wave, Conselho Ômega…). Conta e
 * lançamento sem empresa = pessoal. A empresa EFETIVA de um lançamento é a
 * dele ou, sem ela, a da conta — ver `empresaEfetivaSql`.
 * Doc: "Projeto - MoneyAPP ／ Empresas e agente financeiro" (pasta awldocs do Drive).
 */
export const empresasRouter = Router();
empresasRouter.use(requireAuth);

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** SQL da empresa efetiva de `transactions t` com `accounts a` em LEFT JOIN. */
export const empresaEfetivaSql = sql`coalesce(t.empresa_id, a.empresa_id)`;

/** Recusa empresa de outro dono (o id vem do cliente). */
export async function garantirEmpresaDoDono(
  conn: Tx | typeof db,
  loginhubId: number,
  empresaId: string | null | undefined,
): Promise<boolean> {
  if (!empresaId) return true;
  const row = await conn.query.empresas.findFirst({
    where: and(eq(empresas.id, empresaId), eq(empresas.loginhubId, loginhubId)),
    columns: { id: true },
  });
  return !!row;
}

/** `parentId` não pode fechar ciclo (a empresa virar avó de si mesma). */
async function paiFechaCiclo(loginhubId: number, id: string, parentId: string): Promise<boolean> {
  let atual: string | null = parentId;
  for (let i = 0; atual && i < 20; i++) {
    if (atual === id) return true;
    const row: { parentId: string | null } | undefined = await db.query.empresas.findFirst({
      where: and(eq(empresas.id, atual), eq(empresas.loginhubId, loginhubId)),
      columns: { parentId: true },
    });
    atual = row?.parentId ?? null;
  }
  return false;
}

empresasRouter.get('/', async (req, res, next) => {
  try {
    const rows = await db
      .select()
      .from(empresas)
      .where(eq(empresas.loginhubId, req.user!.loginhubId))
      .orderBy(asc(empresas.nome));
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

empresasRouter.post('/', validate(createEmpresaSchema), async (req, res, next) => {
  try {
    const loginhubId = req.user!.loginhubId;
    const body = req.body as z.infer<typeof createEmpresaSchema>;
    if (!(await garantirEmpresaDoDono(db, loginhubId, body.parentId))) {
      res.status(400).json({ error: 'empresa_mae_invalida' });
      return;
    }
    const [row] = await db
      .insert(empresas)
      .values({
        loginhubId,
        nome: body.nome,
        cnpj: body.cnpj ?? null,
        cor: body.cor ?? null,
        parentId: body.parentId ?? null,
      })
      .onConflictDoNothing()
      .returning();
    if (!row) {
      res.status(409).json({ error: 'empresa_ja_existe' });
      return;
    }
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

empresasRouter.patch('/:id', validate(updateEmpresaSchema), async (req, res, next) => {
  try {
    const loginhubId = req.user!.loginhubId;
    const id = req.params.id!;
    const body = req.body as z.infer<typeof updateEmpresaSchema>;
    if (body.parentId) {
      if (!(await garantirEmpresaDoDono(db, loginhubId, body.parentId)) || (await paiFechaCiclo(loginhubId, id, body.parentId))) {
        res.status(400).json({ error: 'empresa_mae_invalida' });
        return;
      }
    }
    const patch: Record<string, unknown> = {};
    if (body.nome !== undefined) patch.nome = body.nome;
    if (body.cnpj !== undefined) patch.cnpj = body.cnpj;
    if (body.cor !== undefined) patch.cor = body.cor;
    if (body.parentId !== undefined) patch.parentId = body.parentId;
    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: 'nada_para_mudar' });
      return;
    }
    const [row] = await db
      .update(empresas)
      .set(patch)
      .where(and(eq(empresas.id, id), eq(empresas.loginhubId, loginhubId)))
      .returning();
    if (!row) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json(row);
  } catch (err) {
    next(err);
  }
});

// Apagar a empresa não apaga nada dela: contas e lançamentos voltam a ser
// pessoais e as filhas ficam sem mãe (FKs com ON DELETE SET NULL).
empresasRouter.delete('/:id', async (req, res, next) => {
  try {
    const [row] = await db
      .delete(empresas)
      .where(and(eq(empresas.id, req.params.id!), eq(empresas.loginhubId, req.user!.loginhubId)))
      .returning({ id: empresas.id });
    if (!row) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

const resumoQuerySchema = z.object({ month: monthStringSchema.optional() }).strict();

/** Mês corrente em São Paulo, `AAAA-MM`. */
export function mesAtualSP(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 7);
}

/**
 * Resumo do mês por empresa efetiva (uma linha por empresa + a linha pessoal).
 * - receitas/despesas: lançamentos PAGOS do mês (empréstimos de fora, como na lista).
 * - pendentes: tudo pendente com data até o fim do mês (atrasados entram).
 * - saldoContas: contas não congeladas, sem cartão de crédito nem investimento.
 * A holding soma as filhas pelo `parentId` (feito por quem lê: tela e agente).
 */
export async function resumoPorEmpresa(loginhubId: number, month: string): Promise<EmpresaResumo[]> {
  const { start, end } = monthBounds(month);
  const lista = await db
    .select()
    .from(empresas)
    .where(eq(empresas.loginhubId, loginhubId))
    .orderBy(asc(empresas.nome));

  const movimento = await db.execute(sql`
    select ${empresaEfetivaSql} as empresa_id,
      coalesce(sum(case when t.status = 'paid' and t.type = 'income' and t.occurred_at >= ${start} and t.occurred_at < ${end} then t.amount end), 0)::text as receitas,
      coalesce(sum(case when t.status = 'paid' and t.type = 'expense' and t.occurred_at >= ${start} and t.occurred_at < ${end} then t.amount end), 0)::text as despesas,
      coalesce(sum(case when t.status = 'pending' and t.type = 'income' and t.occurred_at < ${end} then t.amount end), 0)::text as pend_receber,
      coalesce(sum(case when t.status = 'pending' and t.type = 'expense' and t.occurred_at < ${end} then t.amount end), 0)::text as pend_pagar,
      count(*) filter (where t.status = 'pending' and t.occurred_at < ${end})::int as qtd_pend
    from transactions t
    left join accounts a on a.id = t.account_id
    where t.loginhub_id = ${loginhubId} and t.loan_id is null
    group by 1
  `);
  const saldos = await db.execute(sql`
    select a.empresa_id,
      coalesce(sum(a.current_balance) filter (where not a.freeze_balance and a.type not in ('credit_card', 'investment')), 0)::text as saldo,
      count(*)::int as qtd
    from accounts a
    where a.loginhub_id = ${loginhubId}
    group by 1
  `);

  type Mov = { empresa_id: string | null; receitas: string; despesas: string; pend_receber: string; pend_pagar: string; qtd_pend: number };
  type Sal = { empresa_id: string | null; saldo: string; qtd: number };
  const movPor = new Map((movimento.rows as Mov[]).map((r) => [r.empresa_id, r]));
  const salPor = new Map((saldos.rows as Sal[]).map((r) => [r.empresa_id, r]));

  const linha = (empresaId: string | null, nome: string, parentId: string | null): EmpresaResumo => {
    const m = movPor.get(empresaId);
    const s = salPor.get(empresaId);
    const receitas = Number(m?.receitas ?? 0);
    const despesas = Number(m?.despesas ?? 0);
    return {
      empresaId,
      nome,
      parentId,
      receitas: receitas.toFixed(2),
      despesas: despesas.toFixed(2),
      resultado: (receitas + despesas).toFixed(2),
      pendentesReceber: Number(m?.pend_receber ?? 0).toFixed(2),
      pendentesPagar: Number(m?.pend_pagar ?? 0).toFixed(2),
      qtdPendentes: m?.qtd_pend ?? 0,
      saldoContas: Number(s?.saldo ?? 0).toFixed(2),
      qtdContas: s?.qtd ?? 0,
    };
  };

  return [...lista.map((e) => linha(e.id, e.nome, e.parentId)), linha(null, 'Pessoal', null)];
}

empresasRouter.get('/resumo', validate(resumoQuerySchema, 'query'), async (req, res, next) => {
  try {
    const { month } = req.query as z.infer<typeof resumoQuerySchema>;
    const mes = month ?? mesAtualSP();
    res.json({ month: mes, empresas: await resumoPorEmpresa(req.user!.loginhubId, mes) });
  } catch (err) {
    next(err);
  }
});
