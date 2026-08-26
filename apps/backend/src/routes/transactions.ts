import { Router } from 'express';
import { and, asc, desc, eq, gte, ilike, isNull, lt, sql } from 'drizzle-orm';
import { createTransactionSchema, transactionFiltersSchema, updateTransactionSchema } from '@moneyapp/models';
import { db, schema } from '@moneyapp/db';
const { accounts, transactions, categories } = schema;
import { requireAuth } from '../middleware/auth.js';
import { authOrConsumer } from '../middleware/consumers.js';
import { validate } from '../middleware/validate.js';

export const transactionsRouter = Router();
// A rota de comprovante (`GET /:id/receipt`) tambem aceita o leitor de servico
// escopado (`receipt.read`) — e o que o TodoAPP consome. Todo o resto do
// roteador continua exigindo sessao de usuario.
const comprovanteOuUsuario = authOrConsumer('receipt.read');
transactionsRouter.use((req, res, next) => {
  const ehComprovante = req.method === 'GET' && /^\/[^/]+\/receipt\/?$/.test(req.path);
  return ehComprovante ? comprovanteOuUsuario(req, res, next) : requireAuth(req, res, next);
});

// ---------- ai-parse ---------------------------------------------------------
transactionsRouter.post('/ai-parse', async (req, res, next) => {
  try {
    const { text, imageBase64 } = req.body;
    if (!text && !imageBase64) return res.status(400).json({ error: 'Text or image is required' });

    const loginhubId = req.user!.loginhubId;

    const [userAccounts, userCategories] = await Promise.all([
      db.query.accounts.findMany({ where: eq(accounts.loginhubId, loginhubId) }),
      db.query.categories.findMany({ where: eq(categories.loginhubId, loginhubId) })
    ]);

    const accountNames = userAccounts.map(a => a.name).join(', ');
    const categoryNames = userCategories.map(c => c.name).join(', ');

    const TZ = 'America/Sao_Paulo';
    const now = new Date();
    const localDate = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: TZ });
    const daysAgo = (n: number) => localDate(new Date(now.getTime() - n * 86_400_000));
    const nowLocal = now.toLocaleString('sv-SE', { timeZone: TZ }).replace(' ', 'T');

    let systemPrompt = '';
    
    if (imageBase64) {
      systemPrompt = `Analise a imagem deste comprovante/recibo.
Extraia as informações rigorosamente neste formato JSON:
{
  "description": <"breve descrição ou nome do estabelecimento">,
  "amount": <numero, ex: 15.50>,
  "type": <"expense" para pagamentos feitos ou "income" para recebimentos>,
  "categoryName": <"Escolha o nome mais apropriado desta lista: [${categoryNames}]. Se não se encaixar perfeitamente, retorne null">,
  "accountName": <"Escolha o nome da conta mais apropriado desta lista: [${accountNames}]. Se não se encaixar perfeitamente, retorne null">,
  "occurredAt": <"YYYY-MM-DDTHH:mm:ss" da transação. Se não tiver hora, use "YYYY-MM-DDT12:00:00">
}
Hoje é ${daysAgo(0)} (agora: ${nowLocal}, fuso ${TZ}).
IMPORTANTE sobre a data: use o ano/mês/dia exatos mostrados no comprovante. Se o comprovante mostrar a data SEM o ano (ex: apenas "17/08" ou "17/08 às 14:30"), assuma o ANO ATUAL (${now.getFullYear()}) — NUNCA invente ou assuma um ano passado como 2023. Se a imagem não tiver nenhuma data visível, use hoje (${daysAgo(0)}).
Retorne APENAS o JSON válido, sem NENHUM texto adicional ou markdown de código.
${text ? `Aviso: o usuário forneceu este contexto adicional: "${text}"` : ''}`;
    } else {
      systemPrompt = `
Você é um assistente financeiro que extrai dados de transações a partir de textos e gera respostas EXCLUSIVAMENTE em JSON, sem texto adicional.
Dada a mensagem do usuário, você deve identificar:
1. "description": A descrição curta da despesa ou receita.
2. "amount": O valor numérico da transação (positivo, use ponto como separador decimal).
3. "type": O tipo da transação. Deve ser obrigatoriamente "expense" ou "income".
4. "categoryName": O nome da categoria que melhor se encaixa, baseando-se nestas opções disponíveis: [${categoryNames}]. Se não se encaixar perfeitamente, retorne null.
5. "accountName": O nome da conta/cartão que foi utilizado, baseando-se nestas opções disponíveis: [${accountNames}]. Se não se encaixar perfeitamente, retorne null.
6. "occurredAt": A data e hora da transação, no formato ISO 8601 (YYYY-MM-DDTHH:mm:ss).
Agora é ${nowLocal} (fuso ${TZ}).
Datas de referência:
  hoje = ${daysAgo(0)}
  ontem = ${daysAgo(1)}
Se a data não for mencionada, use hoje. Se apenas dia/mês forem mencionados (sem ano), use o ano atual (${now.getFullYear()}) — NUNCA invente ou assuma um ano passado.

Exemplo de saída esperada (a data abaixo é apenas ilustrativa do FORMATO; calcule a data real com base nas regras acima):
{
  "description": "Mercado",
  "amount": 150.50,
  "type": "expense",
  "categoryName": "Alimentação",
  "accountName": "Cartão Nubank",
  "occurredAt": "${daysAgo(0)}T10:00:00"
}

Mensagem do usuário: "${text}"
`;
    }

    // Try to import env from services
    const { env } = await import('@moneyapp/services');
    
    // For images we need the vision model (qwen2.5vl:7b), for text llama3.2:3b is faster
    // We just use what's configured or fallback
    const modelToUse = imageBase64 ? 'qwen2.5vl:7b' : 'llama3.2:3b';
    
    const ollamaPayload: any = {
      model: modelToUse,
      prompt: systemPrompt,
      stream: false,
      format: "json"
    };
    
    if (imageBase64) {
      ollamaPayload.images = [imageBase64];
    }

    const response = await fetch(`${env.OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ollamaPayload)
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();
    let extractedStr = data.response?.trim();
    
    // Log for debugging
    console.log('[AI Parse] Raw response:', extractedStr);
    try {
      require('fs').writeFileSync('/tmp/ai_response.json', extractedStr);
    } catch (e) {}
    
    if (!extractedStr) {
      throw new Error('Empty response from AI');
    }

    // Remove markdown blocks
    extractedStr = extractedStr.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();

    let parsed: any = {};
    try {
      parsed = JSON.parse(extractedStr);
    } catch (err) {
      console.error('[AI Parse] Failed to parse JSON:', extractedStr);
      throw err;
    }

    const matchedCategory = userCategories.find(c => c.name.toLowerCase() === parsed.categoryName?.toLowerCase());
    const matchedAccount = userAccounts.find(a => a.name.toLowerCase() === parsed.accountName?.toLowerCase());

    res.json({
      description: parsed.description || parsed.descricao || '',
      amount: Number(parsed.amount || parsed.valor) || null,
      type: (parsed.type === 'income' || parsed.tipo === 'income') ? 'income' : 'expense',
      categoryId: matchedCategory?.id || null,
      accountId: matchedAccount?.id || null,
      occurredAt: parsed.occurredAt || parsed.data || new Date().toISOString()
    });

  } catch (error) {
    req.log.error(error, 'Failed to parse AI text');
    next(error);
  }
});

// ---------- parse-statement (bank app screenshot -> rows) --------------------
// Reads a mobile bank statement screenshot and returns each transaction row
// with its normalized vertical bounds so the client can crop the receipt image.
transactionsRouter.post('/parse-statement', async (req, res, next) => {
  try {
    const { imageBase64 } = req.body ?? {};
    if (!imageBase64) return res.status(400).json({ error: 'image_required' });

    const now = new Date();
    const currentYear = now.getFullYear();

    const systemPrompt = `Você recebe a captura de tela (print) de um extrato bancário de um app de celular.
A tela lista transações agrupadas por dia. Cada grupo tem um cabeçalho de dia (ex: "Sex, 14/ago", "Qua, 12/ago").
Cada transação ocupa uma linha com: um ícone à esquerda, um título (ex: "Pix enviado", "Pix recebido", "Compra realizada", "Pagamento realizado"), o nome/estabelecimento, a hora (ex: "22:40") e o valor (ex: "-R$ 19,50" ou "+R$ 753,00").

Sua tarefa: extrair TODAS as transações e devolver EXCLUSIVAMENTE um JSON no formato:
{
  "rows": [
    {
      "date": "DD/MM" (dia da transação, use o cabeçalho de dia imediatamente ACIMA da linha),
      "time": "HH:mm" (hora exibida na linha),
      "title": "<o título, ex: Pix enviado>",
      "description": "<nome/estabelecimento da linha>",
      "amount": <número decimal com sinal: NEGATIVO para saídas/pagamentos (-R$) e POSITIVO para entradas (+R$), ex: -19.50 ou 753.00>,
      "type": "expense" para saídas ou "income" para entradas,
      "yTop": <número entre 0 e 1: topo da linha completa da transação, sendo 0 = topo da imagem e 1 = base da imagem>,
      "yBottom": <número entre 0 e 1: base da linha completa da transação>
    }
  ]
}

Regras IMPORTANTES:
- yTop e yBottom são FRAÇÕES da ALTURA da imagem (0.0 no topo, 1.0 na base). Devem delimitar toda a linha da transação (do ícone/título até logo antes da próxima linha).
- NÃO inclua a barra de status do celular (relógio, bateria), botões de voltar, nem os cabeçalhos de dia como transações — apenas as linhas de transação reais.
- A data ("DD/MM") vem SEMPRE do cabeçalho de dia acima da linha. Se o cabeçalho não tiver ano, não invente; o cliente assume o ano atual (${currentYear}).
- Ordene as linhas de cima para baixo, na mesma ordem em que aparecem na tela.
- Responda APENAS o JSON válido, sem markdown, sem texto adicional.`;

    const { env } = await import('@moneyapp/services');

    const response = await fetch(`${env.OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen2.5vl:7b',
        prompt: systemPrompt,
        images: [imageBase64],
        stream: false,
        format: 'json',
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();
    let extractedStr: string = data.response?.trim() ?? '';
    if (!extractedStr) throw new Error('Empty response from AI');
    extractedStr = extractedStr.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();

    let parsed: any = {};
    try {
      parsed = JSON.parse(extractedStr);
    } catch (err) {
      req.log.error({ extractedStr }, '[parse-statement] Failed to parse JSON');
      throw err;
    }

    const rawRows: any[] = Array.isArray(parsed) ? parsed : Array.isArray(parsed.rows) ? parsed.rows : [];

    const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
    const rows = rawRows
      .map((r) => {
        const amount = Number(r.amount);
        const yTop = clamp01(Number(r.yTop));
        const yBottom = clamp01(Number(r.yBottom));
        return {
          date: typeof r.date === 'string' ? r.date.trim() : '',
          time: typeof r.time === 'string' ? r.time.trim() : '',
          title: typeof r.title === 'string' ? r.title.trim() : '',
          description: typeof r.description === 'string' ? r.description.trim() : '',
          amount: Number.isFinite(amount) ? amount : null,
          type: r.type === 'income' ? 'income' : 'expense',
          yTop,
          yBottom: yBottom > yTop ? yBottom : Math.min(1, yTop + 0.05),
        };
      })
      .filter((r) => r.amount !== null && r.date);

    res.json({ rows });
  } catch (error) {
    req.log.error(error, 'Failed to parse statement image');
    next(error);
  }
});

// ---------- list -------------------------------------------------------------
transactionsRouter.get('/', validate(transactionFiltersSchema, 'query'), async (req, res, next) => {
  try {
    const loginhubId = req.user!.loginhubId;
    const f = req.query as unknown as import('@moneyapp/models').TransactionFilters;

    const monthRange = f.month ? monthBounds(f.month) : null;
    const from = f.from ?? monthRange?.start;
    const to = f.to ?? monthRange?.end;

    const conds = [eq(transactions.loginhubId, loginhubId), isNull(transactions.loanId)];
    if (from) conds.push(gte(transactions.occurredAt, from));
    if (to) conds.push(lt(transactions.occurredAt, to));
    if (f.type) conds.push(eq(transactions.type, f.type));
    if (f.status) conds.push(eq(transactions.status, f.status));
    if (f.accountId) conds.push(eq(transactions.accountId, f.accountId));
    if (f.categoryId) conds.push(eq(transactions.categoryId, f.categoryId));
    if (f.search) conds.push(ilike(transactions.description, `%${f.search}%`));

    const order = (() => {
      switch (f.sort) {
        case 'date_asc':
          return [asc(transactions.occurredAt)];
        case 'amount_desc':
          return [desc(transactions.amount)];
        case 'amount_asc':
          return [asc(transactions.amount)];
        default:
          return [desc(transactions.occurredAt), desc(transactions.createdAt)];
      }
    })();

    const rows = await db
      .select({
        id: transactions.id,
        description: transactions.description,
        amount: transactions.amount,
        type: transactions.type,
        status: transactions.status,
        occurredAt: transactions.occurredAt,
        categoryId: transactions.categoryId,
        accountId: transactions.accountId,
        subscriptionId: transactions.subscriptionId,
        invoiceCardId: transactions.invoiceCardId,
        hasReceipt: sql<boolean>`${transactions.receiptBase64} is not null`.as('has_receipt'),
        createdAt: transactions.createdAt,
      })
      .from(transactions)
      .where(and(...conds))
      .orderBy(...order)
      .limit(f.limit);

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// ---------- create -----------------------------------------------------------
transactionsRouter.post('/', validate(createTransactionSchema), async (req, res, next) => {
  try {
    const loginhubId = req.user!.loginhubId;
    const body = req.body as import('@moneyapp/models').CreateTransactionInput;

    const created = await db.transaction(async (tx) => {
      const isFatura = await isFaturaPaymentTx(tx, body.accountId ?? null, body.categoryId);
      const status = body.status ?? 'paid';

      if (isFatura && status === 'paid' && (!body.receipt || !body.receipt.base64)) {
        throw new HttpError(400, 'receipt_required_for_fatura_payment');
      }

      const [row] = await tx
        .insert(transactions)
        .values({
          loginhubId,
          description: body.description,
          amount: body.amount.toFixed(2),
          type: body.type,
          status,
          occurredAt: body.occurredAt,
          categoryId: body.categoryId,
          accountId: body.accountId ?? null,
          receiptBase64: body.receipt?.base64 ?? null,
          receiptMimeType: body.receipt?.mimeType ?? null,
        })
        .returning();

      if (row!.accountId && row!.status === 'paid') {
        let delta = Number(row!.amount);
        if (isFatura) delta = Math.abs(delta);
        await applyBalanceDelta(tx, loginhubId, row!.accountId, delta);
      }
      return row!;
    });

    res.status(201).json(stripReceipt(created));
  } catch (err) {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.code });
      return;
    }
    next(err);
  }
});

// ---------- create bulk ------------------------------------------------------
import { z } from 'zod';

transactionsRouter.post('/bulk', validate(z.array(createTransactionSchema)), async (req, res, next) => {
  try {
    const loginhubId = req.user!.loginhubId;
    const items = req.body as import('@moneyapp/models').CreateTransactionInput[];

    const createdRows = await db.transaction(async (tx) => {
      const results = [];
      for (const body of items) {
        const isFatura = await isFaturaPaymentTx(tx, body.accountId ?? null, body.categoryId);
        const status = body.status ?? 'paid';

        if (isFatura && status === 'paid' && (!body.receipt || !body.receipt.base64)) {
          throw new HttpError(400, 'receipt_required_for_fatura_payment');
        }

        const [row] = await tx
          .insert(transactions)
          .values({
            loginhubId,
            description: body.description,
            amount: body.amount.toFixed(2),
            type: body.type,
            status,
            occurredAt: body.occurredAt,
            categoryId: body.categoryId,
            accountId: body.accountId ?? null,
            receiptBase64: body.receipt?.base64 ?? null,
            receiptMimeType: body.receipt?.mimeType ?? null,
          })
          .returning();

        if (row!.accountId && row!.status === 'paid') {
          let delta = Number(row!.amount);
          if (isFatura) delta = Math.abs(delta);
          await applyBalanceDelta(tx, loginhubId, row!.accountId, delta);
        }
        results.push(row!);
      }
      return results;
    });

    res.status(201).json(createdRows.map(stripReceipt));
  } catch (err) {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.code });
      return;
    }
    next(err);
  }
});

// ---------- update -----------------------------------------------------------
transactionsRouter.patch('/:id', validate(updateTransactionSchema), async (req, res, next) => {
  try {
    const loginhubId = req.user!.loginhubId;
    const id = req.params.id!;
    const body = req.body as import('@moneyapp/models').UpdateTransactionInput;

    const updated = await db.transaction(async (tx) => {
      const existing = await tx.query.transactions.findFirst({
        where: and(eq(transactions.id, id), eq(transactions.loginhubId, loginhubId)),
      });
      if (!existing) return null;

      // If both type and amount end up set, re-validate the sign invariant
      // (the .partial() schema can't enforce it without both fields).
      const nextType = body.type ?? existing.type;
      const nextAmount = body.amount ?? Number(existing.amount);
      if (nextType === 'expense' && nextAmount >= 0) {
        throw new HttpError(422, 'amount_must_be_negative_for_expense');
      }
      if (nextType === 'income' && nextAmount <= 0) {
        throw new HttpError(422, 'amount_must_be_positive_for_income');
      }

      const patch: Record<string, unknown> = {};
      if (body.description !== undefined) patch.description = body.description;
      if (body.amount !== undefined) patch.amount = body.amount.toFixed(2);
      if (body.type !== undefined) patch.type = body.type;
      if (body.status !== undefined) patch.status = body.status;
      if (body.occurredAt !== undefined) patch.occurredAt = body.occurredAt;
      if (body.categoryId !== undefined) patch.categoryId = body.categoryId;
      if (body.accountId !== undefined) patch.accountId = body.accountId;
      if (body.subscriptionId !== undefined) patch.subscriptionId = body.subscriptionId;
      if (body.receipt !== undefined) {
        patch.receiptBase64 = body.receipt?.base64 ?? null;
        patch.receiptMimeType = body.receipt?.mimeType ?? null;
      }
      patch.updatedAt = new Date();

      const [row] = await tx
        .update(transactions)
        .set(patch)
        .where(and(eq(transactions.id, id), eq(transactions.loginhubId, loginhubId)))
        .returning();

      const oldIsFatura = await isFaturaPaymentTx(tx, existing.accountId, existing.categoryId);
      const newIsFatura = await isFaturaPaymentTx(tx, row!.accountId, row!.categoryId);

      if (newIsFatura && row!.status === 'paid' && !row!.receiptBase64) {
        throw new HttpError(400, 'receipt_required_for_fatura_payment');
      }

      // Reverse the old delta on the old account, apply the new delta on the
      // new account.
      const oldAmountToReverse = existing.status === 'paid' ? Number(existing.amount) : 0;
      const newAmountToApply = row!.status === 'paid' ? Number(row!.amount) : 0;

      if (existing.accountId && oldAmountToReverse !== 0) {
        let deltaToReverse = oldAmountToReverse;
        if (oldIsFatura) deltaToReverse = Math.abs(deltaToReverse);
        await applyBalanceDelta(tx, loginhubId, existing.accountId, negate(String(deltaToReverse)));
      }
      if (row!.accountId && newAmountToApply !== 0) {
        let deltaToApply = newAmountToApply;
        if (newIsFatura) deltaToApply = Math.abs(deltaToApply);
        await applyBalanceDelta(tx, loginhubId, row!.accountId, deltaToApply);
      }
      return row!;
    });

    if (!updated) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json(stripReceipt(updated));
  } catch (err) {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.code });
      return;
    }
    next(err);
  }
});

// ---------- delete -----------------------------------------------------------
transactionsRouter.delete('/:id', async (req, res, next) => {
  try {
    const loginhubId = req.user!.loginhubId;
    const id = req.params.id!;

    const removed = await db.transaction(async (tx) => {
      const existing = await tx.query.transactions.findFirst({
        where: and(eq(transactions.id, id), eq(transactions.loginhubId, loginhubId)),
      });
      if (!existing) return null;
      await tx
        .delete(transactions)
        .where(and(eq(transactions.id, id), eq(transactions.loginhubId, loginhubId)));
      
      const oldIsFatura = await isFaturaPaymentTx(tx, existing.accountId, existing.categoryId);
      if (existing.accountId && existing.status === 'paid') {
        let deltaToReverse = Number(existing.amount);
        if (oldIsFatura) deltaToReverse = Math.abs(deltaToReverse);
        await applyBalanceDelta(tx, loginhubId, existing.accountId, negate(String(deltaToReverse)));
      }
      return existing;
    });

    if (!removed) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ---------- bulk delete ------------------------------------------------------
transactionsRouter.post(
  '/bulk-delete',
  validate(z.object({ ids: z.array(z.string().uuid()).min(1).max(500) })),
  async (req, res, next) => {
    try {
      const loginhubId = req.user!.loginhubId;
      const { ids } = req.body as { ids: string[] };

      const deleted = await db.transaction(async (tx) => {
        let count = 0;
        for (const id of ids) {
          const existing = await tx.query.transactions.findFirst({
            where: and(eq(transactions.id, id), eq(transactions.loginhubId, loginhubId)),
          });
          if (!existing) continue;

          await tx
            .delete(transactions)
            .where(and(eq(transactions.id, id), eq(transactions.loginhubId, loginhubId)));

          const oldIsFatura = await isFaturaPaymentTx(tx, existing.accountId, existing.categoryId);
          if (existing.accountId && existing.status === 'paid') {
            let deltaToReverse = Number(existing.amount);
            if (oldIsFatura) deltaToReverse = Math.abs(deltaToReverse);
            await applyBalanceDelta(tx, loginhubId, existing.accountId, negate(String(deltaToReverse)));
          }
          count++;
        }
        return count;
      });

      res.json({ deleted });
    } catch (err) {
      next(err);
    }
  },
);

// ---------- receipt streaming ------------------------------------------------
transactionsRouter.get('/:id/receipt', async (req, res, next) => {
  try {
    const loginhubId = req.user!.loginhubId;
    const id = req.params.id!;
    const row = await db.query.transactions.findFirst({
      where: and(eq(transactions.id, id), eq(transactions.loginhubId, loginhubId)),
      columns: { receiptBase64: true, receiptMimeType: true },
    });
    if (!row?.receiptBase64 || !row.receiptMimeType) {
      res.status(404).json({ error: 'no_receipt' });
      return;
    }
    const buffer = Buffer.from(row.receiptBase64, 'base64');
    res.setHeader('Content-Type', row.receiptMimeType);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('Content-Length', buffer.byteLength);
    res.end(buffer);
  } catch (err) {
    next(err);
  }
});

// ---------- helpers ----------------------------------------------------------
export function applyBalanceDelta(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  loginhubId: number,
  accountId: string,
  delta: string | number,
) {
  return tx
    .update(accounts)
    .set({
      currentBalance: sql`${accounts.currentBalance} + ${String(delta)}::numeric`,
    })
    // Frozen accounts keep a historical balance — skip the mutation for them.
    .where(and(eq(accounts.id, accountId), eq(accounts.loginhubId, loginhubId), eq(accounts.freezeBalance, false)));
}

function negate(value: string): string {
  // amount comes back from drizzle as a string ("123.45" / "-50.00"). Just
  // flip the sign textually to avoid float round-trip.
  if (value.startsWith('-')) return value.slice(1);
  return `-${value}`;
}

function stripReceipt<T extends { receiptBase64?: string | null }>(row: T): Omit<T, 'receiptBase64'> & { hasReceipt: boolean } {
  const { receiptBase64, ...rest } = row;
  return { ...rest, hasReceipt: receiptBase64 != null };
}

export class HttpError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

function monthBounds(month: string): { start: Date; end: Date } {
  const [y, m] = month.split('-').map(Number);
  const start = new Date(Date.UTC(y!, m! - 1, 1));
  const end = new Date(Date.UTC(y!, m!, 1));
  return { start, end };
}

export async function isFaturaPaymentTx(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  accountId: string | null,
  categoryId: string | null
): Promise<boolean> {
  if (!accountId || !categoryId) return false;
  const acc = await tx.query.accounts.findFirst({ where: eq(accounts.id, accountId) });
  const cat = await tx.query.categories.findFirst({ where: eq(categories.id, categoryId) });
  return acc?.type === 'credit_card' && !!cat?.name.toUpperCase().includes('FATURA');
}

