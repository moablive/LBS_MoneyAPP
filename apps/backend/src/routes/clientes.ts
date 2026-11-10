import { Router } from 'express';
import { z } from 'zod';
import { db, schema } from '@moneyapp/db';
import { validate } from '../middleware/validate.js';

const { clientes } = schema;

/**
 * Clientes da venda do MoneyAPP: o formulário de assinatura da página /assine
 * grava aqui nome, e-mail, WhatsApp e CPF ou CNPJ antes de mandar a pessoa ao
 * Mercado Pago. Quem cuida da assinatura e do pagamento é o LoginHUB; aqui é só
 * o cadastro do cliente.
 *
 * Rota PÚBLICA (quem compra ainda não tem conta), só de escrita: nada do que
 * está gravado volta por ela. Protegida por limite por IP e pela validação dos
 * dígitos verificadores do documento.
 */
export const clientesRouter = Router();

// ── CPF / CNPJ ───────────────────────────────────────────────────────────────
const repetido = (d: string) => /^(\d)\1+$/.test(d);

function cpfValido(d: string): boolean {
  if (d.length !== 11 || repetido(d)) return false;
  const digito = (ate: number) => {
    let soma = 0;
    for (let i = 0; i < ate; i++) soma += Number(d[i]) * (ate + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(9) === Number(d[9]) && digito(10) === Number(d[10]);
}

function cnpjValido(d: string): boolean {
  if (d.length !== 14 || repetido(d)) return false;
  const digito = (ate: number) => {
    const pesos = ate === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let soma = 0;
    for (let i = 0; i < ate; i++) soma += Number(d[i]) * pesos[i]!;
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return digito(12) === Number(d[12]) && digito(13) === Number(d[13]);
}

// ── Limite por IP ────────────────────────────────────────────────────────────
// Um container só, então um Map resolve (zera no restart). O nginx do frontend
// carimba o IP real em X-Real-IP / X-Forwarded-For.
const JANELA_MS = 15 * 60 * 1000;
const MAX_POR_JANELA = 20;
const baldes = new Map<string, { n: number; expira: number }>();

function passouDoLimite(ip: string): boolean {
  const agora = Date.now();
  if (baldes.size > 2000) for (const [k, v] of baldes) if (v.expira <= agora) baldes.delete(k);
  const b = baldes.get(ip);
  if (!b || b.expira <= agora) {
    baldes.set(ip, { n: 1, expira: agora + JANELA_MS });
    return false;
  }
  b.n += 1;
  return b.n > MAX_POR_JANELA;
}

const clienteSchema = z.object({
  nome: z.string().trim().min(2).max(255),
  email: z.string().trim().toLowerCase().email().max(255),
  telefone: z.string().trim().max(30).optional().nullable(),
  documento: z.string().trim().max(20),
  afiliado: z.string().trim().max(40).optional().nullable(),
  // Referência da assinatura no LoginHUB, mandada depois que o checkout abriu.
  pedido: z.string().trim().regex(/^LH-\d+-[a-f0-9]{8,48}$/).optional().nullable(),
});

clientesRouter.post('/', validate(clienteSchema), async (req, res, next) => {
  try {
    const ip = String(req.headers['cf-connecting-ip'] ?? req.headers['x-real-ip'] ?? String(req.headers['x-forwarded-for'] ?? '').split(',')[0] ?? req.ip ?? 'sem-ip').trim();
    if (passouDoLimite(ip)) {
      res.status(429).json({ error: 'muitas_tentativas', message: 'Muitas tentativas. Aguarde alguns minutos.' });
      return;
    }

    const body = req.body as z.infer<typeof clienteSchema>;
    const documento = body.documento.replace(/\D/g, '');
    const tipoDocumento = documento.length === 14 ? 'cnpj' : 'cpf';
    if (!(tipoDocumento === 'cpf' ? cpfValido(documento) : cnpjValido(documento))) {
      res.status(400).json({ error: 'documento_invalido', message: 'CPF ou CNPJ inválido. Confira os números.' });
      return;
    }

    const dados = {
      nome: body.nome,
      telefone: (body.telefone ?? '').replace(/\D/g, '').slice(0, 20) || null,
      documento,
      tipoDocumento,
      afiliado: body.afiliado || null,
      updatedAt: new Date(),
    };
    // Um cadastro por e-mail: quem volta ao formulário atualiza o que digitou.
    // O `pedido` só é gravado quando vem — a primeira chamada, sem ele, não
    // apaga a referência de uma assinatura anterior.
    await db
      .insert(clientes)
      .values({ email: body.email, ...dados, pedido: body.pedido ?? null })
      .onConflictDoUpdate({ target: clientes.email, set: { ...dados, ...(body.pedido ? { pedido: body.pedido } : {}) } });

    // Sem devolver o cadastro: a rota é pública e só grava.
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});
