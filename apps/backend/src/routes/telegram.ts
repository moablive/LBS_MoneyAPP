import { Router } from 'express';
import crypto from 'node:crypto';
import { db, schema } from '@moneyapp/db';
import { and, eq, gt, isNull, lt, ne } from 'drizzle-orm';
import { env } from '@moneyapp/services';

/**
 * Login híbrido: o PC autentica, o Telegram só recebe o vínculo.
 *
 * O fluxo antigo pedia e-mail, senha e código do 2FA DENTRO do chat. A senha
 * ficava no histórico do Telegram, o código também, e o bot precisava
 * reimplementar o login do hub — inclusive o enrolamento de 2FA, que num chat
 * não tem como acontecer sem expor o segredo no mesmo canal.
 *
 * Aqui a ordem se inverte:
 *
 *   1. a pessoa entra no app pelo PC e passa pelo 2FA de verdade
 *   2. clica em "Vincular Telegram" e o backend emite um passe de uso único
 *   3. o deep link abre o bot com o passe no `/start`
 *   4. o bot troca o passe pelo vínculo, por trás, com a chave de serviço
 *
 * O que atravessa o chat é só o passe — e ele não abre nada além do próprio
 * vínculo, vale poucos minutos e morre no primeiro uso.
 *
 * Sem migração de namespace aqui: no MoneyAPP tudo é chaveado por `loginhub_id`,
 * e o `telegram_id` só serve para o bot descobrir de quem é o chat. (No TodoAPP
 * os dados moram sob o telegramId, e lá o consumo precisa migrá-los.)
 */
export const telegramRouter = Router();

/** Janela curta de propósito: o passe atravessa um canal que guarda histórico. */
const TTL_MINUTOS = 10;

const hash = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

/** `@` opcional no env — o deep link não aceita a arroba. */
const usuarioDoBot = () => (env.TELEGRAM_BOT_USERNAME ?? '').replace(/^@/, '');

/** Já existe Telegram vinculado a esta conta? */
telegramRouter.get('/link', async (req, res) => {
  const linha = await db.query.userSettings.findFirst({
    where: eq(schema.userSettings.loginhubId, req.user!.loginhubId),
  });
  res.json({ telegramId: linha?.telegramId ?? null, bot: usuarioDoBot() || null });
});

/**
 * Emite o passe e devolve o deep link pronto.
 *
 * Os passes anteriores desta conta que ainda não foram usados são apagados: dois
 * QR válidos ao mesmo tempo é convite a vincular o aparelho errado, e quem pede
 * um passe novo está dizendo que o anterior não serviu.
 */
telegramRouter.post('/link-token', async (req, res) => {
  const bot = usuarioDoBot();
  if (!bot) {
    return res.status(500).json({
      error: 'CONFIG_AUSENTE',
      message: 'TELEGRAM_BOT_USERNAME nao esta configurado neste servico.',
    });
  }

  const loginhubId = req.user!.loginhubId;

  await db
    .delete(schema.telegramLinkTokens)
    .where(and(eq(schema.telegramLinkTokens.loginhubId, loginhubId), isNull(schema.telegramLinkTokens.usadoEm)));

  // 32 bytes do CSPRNG. `base64url` porque o payload do /start do Telegram só
  // aceita [A-Za-z0-9_-] e no maximo 64 caracteres.
  const passe = crypto.randomBytes(32).toString('base64url');
  const expiraEm = new Date(Date.now() + TTL_MINUTOS * 60_000);

  await db.insert(schema.telegramLinkTokens).values({
    tokenHash: hash(passe),
    loginhubId,
    expiraEm,
  });

  res.json({
    deepLink: `https://t.me/${bot}?start=${passe}`,
    bot,
    expiresIn: TTL_MINUTOS * 60,
    expiraEm: expiraEm.toISOString(),
  });
});

/** Desfaz o vínculo. O bot volta a não reconhecer aquele Telegram. */
telegramRouter.delete('/link', async (req, res) => {
  await db
    .update(schema.userSettings)
    .set({ telegramId: null })
    .where(eq(schema.userSettings.loginhubId, req.user!.loginhubId));
  res.json({ telegramId: null });
});

/**
 * Consumo do passe — chamado pelo BOT, com a chave de serviço.
 *
 * Fica neste arquivo, e não em `bot.ts`, para o passe e o consumo ficarem lado a
 * lado: quem for mexer numa ponta enxerga a outra. A montagem em `apiRouter`
 * é que separa os dois pela guarda certa.
 */
export const telegramBotRouter = Router();

telegramBotRouter.post('/consume-link-token', async (req, res) => {
  const { token, telegramId } = req.body as { token?: unknown; telegramId?: unknown };

  if (typeof token !== 'string' || !token || typeof telegramId !== 'string' || !telegramId) {
    return res.status(400).json({ error: 'DADOS_INCOMPLETOS', message: 'token e telegramId sao obrigatorios.' });
  }

  const agora = new Date();

  // Limpeza oportunista: sem cron, sem tabela crescendo para sempre. Passe
  // vencido nao serve para nada e nao precisa de auditoria.
  await db.delete(schema.telegramLinkTokens).where(lt(schema.telegramLinkTokens.expiraEm, agora));

  const linha = await db.query.telegramLinkTokens.findFirst({
    where: and(
      eq(schema.telegramLinkTokens.tokenHash, hash(token)),
      isNull(schema.telegramLinkTokens.usadoEm),
      gt(schema.telegramLinkTokens.expiraEm, agora),
    ),
  });

  if (!linha) {
    // Uma mensagem só para os três casos (inexistente, expirado, já usado): de
    // fora não dá para distinguir, e distinguir só ajudaria quem está tentando
    // adivinhar passe.
    return res.status(401).json({
      error: 'PASSE_INVALIDO',
      message: 'Este link de vinculo nao vale mais. Gere outro no app.',
    });
  }

  // Marca ANTES de vincular: se o vinculo falhar, o passe ja morreu e a pessoa
  // gera outro. O contrario — vincular e falhar ao marcar — deixaria um passe
  // vivo que ja produziu efeito.
  const marcado = await db
    .update(schema.telegramLinkTokens)
    .set({ usadoEm: agora })
    .where(and(eq(schema.telegramLinkTokens.tokenHash, linha.tokenHash), isNull(schema.telegramLinkTokens.usadoEm)))
    .returning({ tokenHash: schema.telegramLinkTokens.tokenHash });

  // Zero linhas = outra requisicao consumiu no meio do caminho. E o passe de uso
  // unico funcionando: o segundo a chegar nao vincula.
  if (marcado.length === 0) {
    return res.status(401).json({
      error: 'PASSE_INVALIDO',
      message: 'Este link de vinculo nao vale mais. Gere outro no app.',
    });
  }

  // Solta o vinculo antigo deste Telegram antes de gravar o novo: `telegram_id`
  // tem UNIQUE proprio, e o `ON CONFLICT (loginhub_id)` abaixo nao cobre ele.
  // Sem isto, revincular a uma conta nova do hub estoura 23505 — que e o caso
  // depois de recriar a conta, exatamente quando a pessoa precisa reconquistar
  // os proprios dados.
  await db
    .delete(schema.userSettings)
    .where(
      and(
        eq(schema.userSettings.telegramId, telegramId),
        ne(schema.userSettings.loginhubId, linha.loginhubId),
      ),
    );

  await db
    .insert(schema.userSettings)
    .values({ loginhubId: linha.loginhubId, telegramId })
    .onConflictDoUpdate({
      target: schema.userSettings.loginhubId,
      set: { telegramId },
    });

  res.json({ loginhubId: linha.loginhubId, telegramId });
});
