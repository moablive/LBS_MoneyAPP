import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { env } from '@moneyapp/services';
import { db, schema } from '@moneyapp/db';

/**
 * Payload of a LoginHub-issued user token. MoneyAPP no longer mints user
 * tokens — it only verifies the ones LoginHub signs (shared JWT_SECRET).
 */
export interface LoginHubPayload {
  sub: string; // LoginHub user id (integer, as string)
  email: string;
  app_id?: string;
  role?: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; email: string };
    }
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Verify the Bearer token against the (LoginHub) JWT secret. Returns the
 * decoded payload, or `null` when the header is missing/malformed/invalid.
 * Does NOT touch the database — callers decide how to resolve the identity.
 */
export function verifyBearer(req: Request): LoginHubPayload | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length);
  try {
    return jwt.verify(token, env.JWT_SECRET) as LoginHubPayload;
  } catch {
    return null;
  }
}

/** Resolve a MoneyAPP user (UUID) and attach it to the request. */
async function attachUser(
  res: Response,
  next: NextFunction,
  where: ReturnType<typeof eq>,
  req: Request,
): Promise<void> {
  const user = await db.query.users.findFirst({ where, columns: { id: true, email: true } });
  if (!user) {
    res.status(401).json({ error: 'user_not_provisioned' });
    return;
  }
  req.user = { id: user.id, email: user.email };
  next();
}

/**
 * Authenticate a user request. Two accepted identities:
 *
 *  1. **Web user** — a LoginHub-issued Bearer JWT. Identity is owned by
 *     LoginHub; we map its `email` to the local MoneyAPP user (provisioned at
 *     first login via `POST /auth/bootstrap`).
 *  2. **Trusted bot** — `x-api-key: BOT_SERVICE_KEY` plus `x-user-id: <uuid>`,
 *     the bot acting on behalf of a Telegram-linked user. The bot validated the
 *     user against LoginHub before linking, so we trust the delegated id.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // 1) Trusted bot, delegated identity.
    const apiKey = req.headers['x-api-key'];
    if (typeof apiKey === 'string' && apiKey === env.BOT_SERVICE_KEY) {
      const onBehalfOf = req.headers['x-user-id'];
      if (typeof onBehalfOf !== 'string' || !UUID_RE.test(onBehalfOf)) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }
      await attachUser(res, next, eq(schema.users.id, onBehalfOf), req);
      return;
    }

    // 2) Web user, LoginHub token.
    const payload = verifyBearer(req);
    const email = payload?.email?.toLowerCase().trim();
    if (!email) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    await attachUser(res, next, eq(schema.users.email, email), req);
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
