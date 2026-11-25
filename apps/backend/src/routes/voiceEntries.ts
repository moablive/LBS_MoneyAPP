import { Router } from 'express';
import { and, asc, desc, eq, gte, ilike, like, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '@moneyapp/db';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { garantirEmpresaDoDono } from './empresas.js';
import { HttpError, applyBalanceDelta, isFaturaPaymentTx } from './transactions.js';

const { voiceEntries, transactions, categories, accounts } = schema;

/**
 * Registro por voz (25/11/2026): contas ditas ao bot do Telegram. Não são lançamentos:
 * ficam aqui, sem categoria obrigatória e sem tocar no saldo, até o dono confirmar no
 * app — aí nasce a transação (mesma regra de POST /transactions) e a entrada vira
 * `confirmed`. O bot grava com o token delegado do usuário, como nas outras rotas.
 * Guia: "Projeto - MoneyAPP ／ Registro por voz (plano)", pasta 📦 Documentação do servidor do Drive.
 */
export const voiceEntriesRouter = Router();
voiceEntriesRouter.use(requireAuth);

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Entry = typeof voiceEntries.$inferSelect;

const uuid = z.string().uuid();
const tipo = z.enum(['expense', 'income']);

const createSchema = z
  .object({
    transcription: z.string().trim().min(1).max(2000),
    description: z.string().trim().min(1).max(255),
    amount: z.number().finite().positive().max(99_999_999),
    type: tipo,
    occurredAt: z.coerce.date(),
    suggestedCategoryId: uuid.nullish(),
    suggestedAccountId: uuid.nullish(),
    externalKey: z.string().trim().min(1).max(80).nullish(),
  })
  .strict();

const updateSchema = z
  .object({
    description: z.string().trim().min(1).max(255),
    amount: z.number().finite().positive().max(99_999_999),
    type: tipo,
    occurredAt: z.coerce.date(),
    categoryId: uuid.nullable(),
    accountId: uuid.nullable(),
    empresaId: uuid.nullable(),
  })
  .partial()
  .strict();

const confirmSchema = z
  .object({
    categoryId: uuid.optional(),
    accountId: uuid.nullish(),
    empresaId: uuid.nullish(),
  })
  .strict();

const batchSchema = z.object({ ids: z.array(uuid).min(1).max(100) }).strict();

const filtersSchema = z
  .object({
    status: z.enum(['pending', 'confirmed', 'all']).default('pending'),
    search: z.string().trim().min(1).max(120).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    type: tipo.optional(),
    min: z.coerce.number().nonnegative().optional(),
    max: z.coerce.number().nonnegative().optional(),
    categoria: z.union([uuid, z.literal('sem')]).optional(),
    sort: z.enum(['date_desc', 'date_asc', 'amount_desc', 'amount_asc']).default('date_desc'),
    limit: z.coerce.number().int().min(1).max(200).default(100),
  })
  .strict();

/** Categoria e conta têm de ser do dono; a categoria, do mesmo tipo da entrada. */
async function validarEscolhas(
  conn: Tx | typeof db,
  loginhubId: number,
  e: { type: 'expense' | 'income'; categoryId?: string | null; accountId?: string | null; empresaId?: string | null },
): Promise<string | null> {
  if (e.categoryId) {
    const cat = await conn.query.categories.findFirst({
      where: and(eq(categories.id, e.categoryId), eq(categories.loginhubId, loginhubId)),
      columns: { type: true },
    });
    if (!cat) return 'categoria_invalida';
    if (cat.type !== e.type) return 'categoria_de_outro_tipo';
  }
  if (e.accountId) {
    const acc = await conn.query.accounts.findFirst({
      where: and(eq(accounts.id, e.accountId), eq(accounts.loginhubId, loginhubId)),
      columns: { id: true },
    });
    if (!acc) return 'conta_invalida';
  }
  if (!(await garantirEmpresaDoDono(conn, loginhubId, e.empresaId))) return 'empresa_invalida';
  return null;
}

/** Vira lançamento: mesma regra de POST /transactions (saldo, pagamento de fatura). */
async function confirmarEntrada(
  loginhubId: number,
  id: string,
  over: { categoryId?: string; accountId?: string | null; empresaId?: string | null },
): Promise<Entry> {
  return db.transaction(async (tx) => {
    const entry = await tx.query.voiceEntries.findFirst({
      where: and(eq(voiceEntries.id, id), eq(voiceEntries.loginhubId, loginhubId)),
    });
    if (!entry) throw new HttpError(404, 'not_found');
    if (entry.status !== 'pending') throw new HttpError(409, 'ja_confirmado');

    const categoryId = over.categoryId ?? entry.categoryId;
    const accountId = over.accountId !== undefined ? over.accountId : entry.accountId;
    const empresaId = over.empresaId !== undefined ? over.empresaId : entry.empresaId;
    if (!categoryId) throw new HttpError(400, 'categoria_obrigatoria');
    const erro = await validarEscolhas(tx, loginhubId, { type: entry.type, categoryId, accountId, empresaId });
    if (erro) throw new HttpError(400, erro);

    const conta = accountId
      ? await tx.query.accounts.findFirst({ where: eq(accounts.id, accountId), columns: { type: true } })
      : null;
    // Cartão fica pendente (entra na fatura); o resto já foi pago, como o bot fazia.
    const status = conta?.type === 'credit_card' ? 'pending' : 'paid';
    const isFatura = await isFaturaPaymentTx(tx, accountId ?? null, categoryId);
    if (isFatura && status === 'paid') throw new HttpError(400, 'receipt_required_for_fatura_payment');

    const valor = entry.type === 'expense' ? `-${entry.amount}` : entry.amount;
    const [row] = await tx
      .insert(transactions)
      .values({
        loginhubId,
        description: entry.description,
        amount: valor,
        type: entry.type,
        status,
        occurredAt: entry.occurredAt,
        categoryId,
        accountId: accountId ?? null,
        empresaId: empresaId ?? null,
      })
      .returning({ id: transactions.id });
    if (accountId && status === 'paid') await applyBalanceDelta(tx, loginhubId, accountId, valor);

    const [feito] = await tx
      .update(voiceEntries)
      .set({ status: 'confirmed', transactionId: row!.id, categoryId, accountId: accountId ?? null, empresaId: empresaId ?? null, confirmedAt: new Date() })
      .where(eq(voiceEntries.id, id))
      .returning();
    return feito!;
  });
}

function responder(res: import('express').Response, next: import('express').NextFunction, err: unknown) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.code });
    return;
  }
  next(err);
}

// ---------- list -------------------------------------------------------------
voiceEntriesRouter.get('/', validate(filtersSchema, 'query'), async (req, res, next) => {
  try {
    const f = req.query as unknown as z.infer<typeof filtersSchema>;
    const conds = [eq(voiceEntries.loginhubId, req.user!.loginhubId)];
    if (f.status !== 'all') conds.push(eq(voiceEntries.status, f.status));
    if (f.type) conds.push(eq(voiceEntries.type, f.type));
    if (f.from) conds.push(gte(voiceEntries.occurredAt, f.from));
    if (f.to) conds.push(lt(voiceEntries.occurredAt, f.to));
    if (f.min !== undefined) conds.push(sql`${voiceEntries.amount} >= ${f.min}`);
    if (f.max !== undefined) conds.push(sql`${voiceEntries.amount} <= ${f.max}`);
    if (f.categoria === 'sem') conds.push(sql`${voiceEntries.categoryId} is null`);
    else if (f.categoria) conds.push(eq(voiceEntries.categoryId, f.categoria));
    if (f.search) {
      const termo = `%${f.search}%`;
      conds.push(sql`(${ilike(voiceEntries.description, termo)} or ${ilike(voiceEntries.transcription, termo)})`);
    }
    const ordem =
      f.sort === 'date_asc' ? [asc(voiceEntries.occurredAt)]
      : f.sort === 'amount_desc' ? [desc(voiceEntries.amount)]
      : f.sort === 'amount_asc' ? [asc(voiceEntries.amount)]
      : [desc(voiceEntries.occurredAt), desc(voiceEntries.createdAt)];
    res.json(await db.select().from(voiceEntries).where(and(...conds)).orderBy(...ordem).limit(f.limit));
  } catch (err) {
    next(err);
  }
});

// Contador do selo do menu.
voiceEntriesRouter.get('/summary', async (req, res, next) => {
  try {
    const [row] = await db
      .select({ pending: sql<number>`count(*)::int` })
      .from(voiceEntries)
      .where(and(eq(voiceEntries.loginhubId, req.user!.loginhubId), eq(voiceEntries.status, 'pending')));
    res.json({ pending: row?.pending ?? 0 });
  } catch (err) {
    next(err);
  }
});

// ---------- create (bot) -----------------------------------------------------
voiceEntriesRouter.post('/', validate(createSchema), async (req, res, next) => {
  try {
    const loginhubId = req.user!.loginhubId;
    const b = req.body as z.infer<typeof createSchema>;
    // Sugestão da IA que não é do dono não é gravada: vira "sem sugestão".
    const [cat, acc] = await Promise.all([
      b.suggestedCategoryId
        ? db.query.categories.findFirst({ where: and(eq(categories.id, b.suggestedCategoryId), eq(categories.loginhubId, loginhubId)), columns: { id: true } })
        : null,
      b.suggestedAccountId
        ? db.query.accounts.findFirst({ where: and(eq(accounts.id, b.suggestedAccountId), eq(accounts.loginhubId, loginhubId)), columns: { id: true } })
        : null,
    ]);
    const [criada] = await db
      .insert(voiceEntries)
      .values({
        loginhubId,
        transcription: b.transcription,
        description: b.description,
        amount: b.amount.toFixed(2),
        type: b.type,
        occurredAt: b.occurredAt,
        suggestedCategoryId: cat?.id ?? null,
        suggestedAccountId: acc?.id ?? null,
        externalKey: b.externalKey ?? null,
      })
      .onConflictDoNothing()
      .returning();
    if (criada) {
      res.status(201).json(criada);
      return;
    }
    // O mesmo áudio já foi gravado (reenvio do Telegram): devolve o que existe.
    const existente = await db.query.voiceEntries.findFirst({
      where: and(eq(voiceEntries.loginhubId, loginhubId), eq(voiceEntries.externalKey, b.externalKey ?? '')),
    });
    res.status(200).json(existente);
  } catch (err) {
    next(err);
  }
});

// ---------- undo (bot): apaga o que ainda está pendente daquela mensagem ------------
voiceEntriesRouter.delete('/source/:key', async (req, res, next) => {
  try {
    const key = String(req.params.key);
    if (!/^-?\d+:\d+$/.test(key)) {
      res.status(400).json({ error: 'chave_invalida' });
      return;
    }
    const apagadas = await db
      .delete(voiceEntries)
      .where(and(eq(voiceEntries.loginhubId, req.user!.loginhubId), eq(voiceEntries.status, 'pending'), like(voiceEntries.externalKey, `${key}:%`)))
      .returning({ id: voiceEntries.id });
    res.json({ deleted: apagadas.length });
  } catch (err) {
    next(err);
  }
});

// ---------- batch confirm ----------------------------------------------------
voiceEntriesRouter.post('/confirm-batch', validate(batchSchema), async (req, res, next) => {
  try {
    const { ids } = req.body as z.infer<typeof batchSchema>;
    const confirmadas: string[] = [];
    const puladas: { id: string; error: string }[] = [];
    for (const id of ids) {
      try {
        await confirmarEntrada(req.user!.loginhubId, id, {});
        confirmadas.push(id);
      } catch (err) {
        if (!(err instanceof HttpError)) throw err;
        puladas.push({ id, error: err.code });
      }
    }
    res.json({ confirmed: confirmadas, skipped: puladas });
  } catch (err) {
    next(err);
  }
});

// ---------- update / confirm / delete ---------------------------------------------
voiceEntriesRouter.patch('/:id', validate(updateSchema), async (req, res, next) => {
  try {
    const loginhubId = req.user!.loginhubId;
    const id = uuid.safeParse(req.params.id);
    if (!id.success) {
      res.status(400).json({ error: 'id_invalido' });
      return;
    }
    const b = req.body as z.infer<typeof updateSchema>;
    const atual = await db.query.voiceEntries.findFirst({
      where: and(eq(voiceEntries.id, id.data), eq(voiceEntries.loginhubId, loginhubId)),
    });
    if (!atual) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    if (atual.status !== 'pending') {
      res.status(409).json({ error: 'ja_confirmado' });
      return;
    }
    const tipoFinal = b.type ?? atual.type;
    // Trocar o tipo invalida a categoria escolhida (categoria é de um tipo só).
    const categoryId = b.categoryId !== undefined ? b.categoryId : tipoFinal !== atual.type ? null : atual.categoryId;
    const erro = await validarEscolhas(db, loginhubId, { type: tipoFinal, categoryId, accountId: b.accountId, empresaId: b.empresaId });
    if (erro) {
      res.status(400).json({ error: erro });
      return;
    }
    const [row] = await db
      .update(voiceEntries)
      .set({
        ...(b.description !== undefined && { description: b.description }),
        ...(b.amount !== undefined && { amount: b.amount.toFixed(2) }),
        ...(b.type !== undefined && { type: b.type }),
        ...(b.occurredAt !== undefined && { occurredAt: b.occurredAt }),
        ...(b.accountId !== undefined && { accountId: b.accountId }),
        ...(b.empresaId !== undefined && { empresaId: b.empresaId }),
        categoryId,
      })
      .where(eq(voiceEntries.id, id.data))
      .returning();
    res.json(row);
  } catch (err) {
    next(err);
  }
});

voiceEntriesRouter.post('/:id/confirm', validate(confirmSchema), async (req, res, next) => {
  try {
    const id = uuid.safeParse(req.params.id);
    if (!id.success) {
      res.status(400).json({ error: 'id_invalido' });
      return;
    }
    res.json(await confirmarEntrada(req.user!.loginhubId, id.data, req.body as z.infer<typeof confirmSchema>));
  } catch (err) {
    responder(res, next, err);
  }
});

voiceEntriesRouter.delete('/:id', async (req, res, next) => {
  try {
    const id = uuid.safeParse(req.params.id);
    if (!id.success) {
      res.status(400).json({ error: 'id_invalido' });
      return;
    }
    const apagadas = await db
      .delete(voiceEntries)
      .where(and(eq(voiceEntries.id, id.data), eq(voiceEntries.loginhubId, req.user!.loginhubId), eq(voiceEntries.status, 'pending')))
      .returning({ id: voiceEntries.id });
    if (!apagadas.length) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
