import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '@moneyapp/services';

export interface AuthPayload {
  sub: string; // user id
  email: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; email: string };
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const token = header.slice('Bearer '.length);
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch {
    res.status(401).json({ error: 'invalid_token' });
  }
}

export function signToken(payload: AuthPayload): string {
  // @types/jsonwebtoken v9 narrowed `expiresIn` from `string` to a template
  // literal type. Our env-validated string is correct at runtime — cast to
  // SignOptions to keep the type system happy.
  const opts = { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions;
  return jwt.sign(payload, env.JWT_SECRET, opts);
}
