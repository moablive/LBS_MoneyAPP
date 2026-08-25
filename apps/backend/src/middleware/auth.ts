import type { NextFunction, Request, Response } from 'express';
import { env } from '@moneyapp/services';
import { LoginHubPayload } from '@moneyapp/models';
import { verifyHubToken, HubAuthError, bearerDoRequest } from '../lib/hubAuthServer.js';

/** Config da guarda do hub. Uma só, montada a partir do env validado. */
const hubConfig = { secret: env.JWT_SECRET, appId: env.LOGINHUB_APP_ID };

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { loginhubId: number; email: string };
    }
  }
}

/**
 * Verify the Bearer token against the (LoginHub) JWT secret. Returns the
 * decoded payload, or `null` when the header is missing/malformed/invalid.
 * Does NOT touch the database — callers decide how to resolve the identity.
 *
 * Delega ao `verifyHubToken` do auth-kit, que além da assinatura recusa os
 * passes de etapa única do hub (`action: '2fa-challenge' | '2fa-setup' |
 * 'setup-password'`) e os tokens de outro tenant. Um `jwt.verify` cru aceitava
 * os três: o passe de enrolamento se obtém só com a senha e carrega `sub`,
 * `email` e `role`, então valia como sessão aqui — o segundo fator não
 * protegia esta API.
 */
export function verifyBearer(req: Request): LoginHubPayload | null {
  const token = bearerDoRequest(req);
  if (!token) return null;
  try {
    return verifyHubToken(token, hubConfig) as LoginHubPayload;
  } catch {
    return null;
  }
}

/**
 * Authenticate a user request. Two accepted identities:
 *
 *  1. **Web user** — a LoginHub-issued Bearer JWT. Identity is owned by
 *     LoginHub.
 *  2. **Trusted bot** — `x-api-key: BOT_SERVICE_KEY` plus `x-user-id: <id>`,
 *     the bot acting on behalf of a Telegram-linked user. The bot validated the
 *     user against LoginHub before linking, so we trust the delegated id.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // 1) Trusted bot, delegated identity.
    const apiKey = req.headers['x-api-key'];
    if (typeof apiKey === 'string' && apiKey === env.BOT_SERVICE_KEY) {
      const onBehalfOf = req.headers['x-user-id'];
      if (typeof onBehalfOf !== 'string' || !onBehalfOf || isNaN(Number(onBehalfOf))) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }
      req.user = { loginhubId: parseInt(onBehalfOf, 10), email: '' }; // Bot might not send email
      next();
      return;
    }

    // 2) Web user, LoginHub token.
    const token = bearerDoRequest(req);
    if (!token) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    // Aqui o erro é propagado com o código do hub em vez de virar um
    // `unauthorized` genérico: o frontend precisa distinguir "sessão expirada"
    // (renova) de "isto é um passe de etapa única" (conclua o 2FA).
    let payload: LoginHubPayload;
    try {
      payload = verifyHubToken(token, hubConfig) as LoginHubPayload;
    } catch (err) {
      const e = err as HubAuthError;
      const status = e instanceof HubAuthError ? e.status : 401;
      res.status(status).json({ error: e instanceof HubAuthError ? e.code : 'unauthorized', message: e?.message });
      return;
    }

    if (!payload.email) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    req.user = { loginhubId: parseInt(payload.sub, 10), email: payload.email };
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Guard for service-to-service `/bot/*` routes that don't act as a single user
 * (the user id travels in the query/body). The Telegram bot presents the shared
 * key; end-user credentials are validated by the bot against LoginHub directly.
 */
export function requireBotKey(req: Request, res: Response, next: NextFunction): void {
  const key = req.headers['x-api-key'];
  if (typeof key !== 'string' || key !== env.BOT_SERVICE_KEY) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  next();
}
