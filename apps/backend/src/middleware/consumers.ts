import type { NextFunction, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { env } from '@moneyapp/services';
import { db, schema } from '@moneyapp/db';
import { requireAuth } from './auth.js';
import { veioDaBordaPublica } from './rede.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Consumidor de servico que autenticou a chamada (quando nao e usuario web). */
      consumer?: { id: string; scopes: string[] };
    }
  }
}

interface Consumer {
  id: string;
  secret: string;
  scopes: Set<string>;
}

/**
 * Registro de consumidores de servico confiaveis.
 *
 * Formato de `MONEYAPP_CONSUMERS`: `<id>:<segredo>:<escopo1,escopo2>;<id2>:...`
 * Ex.: `todoapp:<segredo>:calendar.read,receipt.read`.
 *
 * Vazio (o caso de hoje, decisao de REAPROVEITAR a chave atual): um unico
 * consumidor `internal` com o `BOT_SERVICE_KEY` que ja existe, com escopo de
 * leitura de calendario e comprovante. Assim nenhum segredo novo precisa ser
 * emitido agora e o TodoAPP segue chamando exatamente como chama.
 *
 * O ponto arquitetural (contra a delegacao cega do `requireAuth`): aqui a chave
 * identifica QUEM chama e limita a QUE ele acessa, e o `x-user-id` so vale se a
 * conta consentir — ao contrario da confianca cega no id.
 */
function carregarConsumidores(): Consumer[] {
  const bruto = env.MONEYAPP_CONSUMERS?.trim();
  if (!bruto) {
    return [{
      id: 'internal',
      secret: env.BOT_SERVICE_KEY,
      scopes: new Set(['calendar.read', 'receipt.read']),
    }];
  }
  return bruto
    .split(';')
    .map((seg) => seg.trim())
    .filter(Boolean)
    .map((seg) => {
      const [id, secret, scopes] = seg.split(':');
      return {
        id: (id ?? '').trim(),
        secret: (secret ?? '').trim(),
        scopes: new Set((scopes ?? '').split(',').map((s) => s.trim()).filter(Boolean)),
      };
    })
    .filter((c) => c.id.length > 0 && c.secret.length > 0);
}

const CONSUMIDORES = carregarConsumidores();

function resolverConsumidor(apiKey: string): Consumer | null {
  return CONSUMIDORES.find((c) => c.secret === apiKey) ?? null;
}

/**
 * A conta `loginhubId` consente ser lida pelo consumidor `consumerId`?
 *
 * O consentimento mora AQUI, no MoneyAPP (em `user_settings.settings`), e nao no
 * banco do TodoAPP — o dono do recurso e quem autoriza. `settings.leitoresExternos`
 * e a lista de ids de consumidor liberados para aquela conta.
 */
async function contaConsenteLeitor(loginhubId: number, consumerId: string): Promise<boolean> {
  const row = await db.query.userSettings.findFirst({
    where: eq(schema.userSettings.loginhubId, loginhubId),
    columns: { settings: true },
  });
  const lista = (row?.settings as { leitoresExternos?: unknown } | undefined)?.leitoresExternos;
  return Array.isArray(lista) && lista.includes(consumerId);
}

/**
 * Aceita DUAS identidades, mas o ramo de servico e escopado e autorizado pelo
 * dono do recurso — diferente do `requireAuth`, cujo ramo legado confia cego no
 * `x-user-id`:
 *
 *   - Usuario web  -> cai no `requireAuth` (Bearer do LoginHub).
 *   - Consumidor   -> `x-api-key` de um consumidor CONHECIDO, COM o escopo
 *                     exigido, agindo por `x-user-id` SO se a conta consentir.
 *
 * E chave de servico vinda da borda publica e recusada de saida (ver rede.ts).
 */
export function authOrConsumer(...escoposExigidos: string[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const apiKey = req.headers['x-api-key'];

    // Sem chave de servico: e usuario web, segue pela guarda normal.
    if (typeof apiKey !== 'string' || apiKey.length === 0) {
      return requireAuth(req, res, next);
    }

    if (veioDaBordaPublica(req) && !env.TRUST_EDGE_SERVICE_KEY) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    const consumer = resolverConsumidor(apiKey);
    if (!consumer) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    if (!escoposExigidos.every((s) => consumer.scopes.has(s))) {
      res.status(403).json({ error: 'forbidden_scope' });
      return;
    }

    const onBehalfOf = req.headers['x-user-id'];
    if (typeof onBehalfOf !== 'string' || !onBehalfOf || isNaN(Number(onBehalfOf))) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    const loginhubId = parseInt(onBehalfOf, 10);

    if (!(await contaConsenteLeitor(loginhubId, consumer.id))) {
      if (env.ALLOW_LEGACY_BOT_DELEGATION) {
        // Janela de compatibilidade: hoje ainda nao ha consentimento gravado, e
        // desligar isso de uma vez quebraria a leitura do TodoAPP. Nao bloqueia,
        // mas registra — quando `ALLOW_LEGACY_BOT_DELEGATION` virar `false` isto
        // passa a devolver 403. Semeie o consentimento antes de fechar a janela.
        console.warn(
          `[consumers] leitura cross-app sem consentimento: consumer=${consumer.id} loginhubId=${loginhubId} (permitida pela janela legada)`,
        );
      } else {
        res.status(403).json({ error: 'forbidden' });
        return;
      }
    }

    req.consumer = { id: consumer.id, scopes: [...consumer.scopes] };
    req.user = { loginhubId, email: '' };
    next();
  };
}
