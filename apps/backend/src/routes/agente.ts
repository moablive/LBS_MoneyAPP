import { Router } from 'express';
import { and, asc, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { monthStringSchema, transactionFiltersSchema, transactionTypeEnum } from '@moneyapp/models';
import { db, schema } from '@moneyapp/db';
const { accounts, categories, empresas, investments, loans, subscriptions, transactions } = schema;
import { somenteConsumidor } from '../middleware/consumers.js';
import { validate } from '../middleware/validate.js';
import { listarTransacoes } from './transactions.js';
import { garantirEmpresaDoDono, mesAtualSP, resumoPorEmpresa } from './empresas.js';

/**
 * API do 💰 Financeiro do Conselho do Moab (perfil `conselho-financeiro` do
 * hermes-agent, servidor MCP `moneyapp-mcp`). Só consumidor de serviço, com o
 * consentimento do dono, e só duas coisas: LER e LANÇAR PENDENTE. Nada aqui
 * marca como pago, edita, apaga ou mexe em saldo: o dono confirma no app.
 * Doc: "Projeto - MoneyAPP ／ Empresas e agente financeiro" (pasta awldocs do Drive).
 */
export const agenteRouter = Router();
const ler = somenteConsumidor('financas.read');
const lancar = somenteConsumidor('financas.lancar-pendente');

/** Marca de quem lançou, visível na lista do app. */
export const PREFIXO_AGENTE = '[Financeiro] ';

agenteRouter.get('/empresas', ler, async (req, res, next) => {
  try {
    res.json(
      await db
        .select({ id: empresas.id, nome: empresas.nome, cnpj: empresas.cnpj, parentId: empresas.parentId })
        .from(empresas)
        .where(eq(empresas.loginhubId, req.user!.loginhubId))
        .orderBy(asc(empresas.nome)),
    );
  } catch (err) {
    next(err);
  }
});

const mesSchema = z.object({ month: monthStringSchema.optional() }).strict();

agenteRouter.get('/resumo', ler, validate(mesSchema, 'query'), async (req, res, next) => {
  try {
    const mes = (req.query as z.infer<typeof mesSchema>).month ?? mesAtualSP();
    res.json({ month: mes, empresas: await resumoPorEmpresa(req.user!.loginhubId, mes) });
  } catch (err) {
    next(err);
  }
});

agenteRouter.get('/contas', ler, async (req, res, next) => {
  try {
    res.json(
      await db
        .select({
          id: accounts.id,
          nome: accounts.name,
          tipo: accounts.type,
          banco: accounts.bankCode,
          saldo: accounts.currentBalance,
          congelada: accounts.freezeBalance,
          limite: accounts.creditLimit,
          fechamento: accounts.closingDay,
          vencimento: accounts.dueDay,
          empresaId: accounts.empresaId,
        })
        .from(accounts)
        .where(eq(accounts.loginhubId, req.user!.loginhubId))
        .orderBy(asc(accounts.name)),
    );
  } catch (err) {
    next(err);
  }
});

agenteRouter.get('/categorias', ler, async (req, res, next) => {
  try {
    res.json(
      await db
        .select({ id: categories.id, nome: categories.name, tipo: categories.type })
        .from(categories)
        .where(eq(categories.loginhubId, req.user!.loginhubId))
        .orderBy(asc(categories.name)),
    );
  } catch (err) {
    next(err);
  }
});

agenteRouter.get('/transacoes', ler, validate(transactionFiltersSchema, 'query'), async (req, res, next) => {
  try {
    const f = req.query as unknown as import('@moneyapp/models').TransactionFilters;
    res.json(await listarTransacoes(req.user!.loginhubId, f));
  } catch (err) {
    next(err);
  }
});

agenteRouter.get('/assinaturas', ler, async (req, res, next) => {
  try {
    res.json(
      await db
        .select({
          id: subscriptions.id,
          descricao: subscriptions.description,
          valor: subscriptions.amount,
          tipo: subscriptions.type,
          status: subscriptions.status,
          diaCobranca: subscriptions.billingDay,
          categoriaId: subscriptions.categoryId,
          contaId: subscriptions.accountId,
        })
        .from(subscriptions)
        .where(eq(subscriptions.loginhubId, req.user!.loginhubId))
        .orderBy(asc(subscriptions.description)),
    );
  } catch (err) {
    next(err);
  }
});

agenteRouter.get('/emprestimos', ler, async (req, res, next) => {
  try {
    res.json(
      await db
        .select({
          id: loans.id,
          descricao: loans.description,
          valor: loans.amount,
          valorEsperado: loans.expectedAmount,
          data: loans.date,
          tipo: loans.type,
          status: loans.status,
          contaId: loans.accountId,
        })
        .from(loans)
        .where(eq(loans.loginhubId, req.user!.loginhubId))
        .orderBy(desc(loans.date)),
    );
  } catch (err) {
    next(err);
  }
});

agenteRouter.get('/investimentos', ler, async (req, res, next) => {
  try {
    res.json(
      await db
        .select({
          id: investments.id,
          nome: investments.name,
          tipo: investments.type,
          quantidade: investments.quantity,
          precoCompra: investments.buyPrice,
          precoAtual: investments.currentPrice,
          dataCompra: investments.buyDate,
          meta: investments.goalAmount,
          contaId: investments.accountId,
        })
        .from(investments)
        .where(eq(investments.loginhubId, req.user!.loginhubId))
        .orderBy(asc(investments.name)),
    );
  } catch (err) {
    next(err);
  }
});

// Lançamento PENDENTE: o status é fixo, não há campo para mudar. Pendente
// nunca mexe no saldo da conta (só `paid` mexe, em routes/transactions.ts).
const lancamentoSchema = z
  .object({
    descricao: z.string().trim().min(1).max(200),
    valor: z.number().finite().positive().max(10_000_000),
    tipo: transactionTypeEnum,
    data: z.coerce.date(),
    categoriaId: z.string().uuid(),
    contaId: z.string().uuid().nullish(),
    empresaId: z.string().uuid().nullish(),
  })
  .strict();

agenteRouter.post('/lancamentos', lancar, validate(lancamentoSchema), async (req, res, next) => {
  try {
    const loginhubId = req.user!.loginhubId;
    const body = req.body as z.infer<typeof lancamentoSchema>;

    const categoria = await db.query.categories.findFirst({
      where: and(eq(categories.id, body.categoriaId), eq(categories.loginhubId, loginhubId)),
      columns: { type: true },
    });
    if (!categoria) {
      res.status(400).json({ error: 'categoria_invalida' });
      return;
    }
    if (categoria.type !== body.tipo) {
      res.status(400).json({ error: 'categoria_de_outro_tipo' });
      return;
    }
    if (body.contaId) {
      const conta = await db.query.accounts.findFirst({
        where: and(eq(accounts.id, body.contaId), eq(accounts.loginhubId, loginhubId)),
        columns: { id: true },
      });
      if (!conta) {
        res.status(400).json({ error: 'conta_invalida' });
        return;
      }
    }
    if (!(await garantirEmpresaDoDono(db, loginhubId, body.empresaId))) {
      res.status(400).json({ error: 'empresa_invalida' });
      return;
    }

    const valor = body.tipo === 'expense' ? -body.valor : body.valor;
    const [row] = await db
      .insert(transactions)
      .values({
        loginhubId,
        description: `${PREFIXO_AGENTE}${body.descricao}`.slice(0, 255),
        amount: valor.toFixed(2),
        type: body.tipo,
        status: 'pending',
        occurredAt: body.data,
        categoryId: body.categoriaId,
        accountId: body.contaId ?? null,
        empresaId: body.empresaId ?? null,
      })
      .returning({
        id: transactions.id,
        descricao: transactions.description,
        valor: transactions.amount,
        status: transactions.status,
        data: transactions.occurredAt,
      });
    console.info(`[agente] ${req.consumer?.id} lançou pendente ${row!.id} (${row!.valor}) para ${loginhubId}`);
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});
