import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { loginSchema } from '@moneyapp/models';
import { db, schema } from '@moneyapp/db';
const { users } = schema;
import { validate } from '../middleware/validate.js';
import { signToken } from '../middleware/auth.js';
import { verifyPassword } from '@moneyapp/services';

export const authRouter = Router();

authRouter.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body as import('@moneyapp/models').LoginInput;
    const user = await db.query.users.findFirst({ where: eq(users.email, email) });
    // Constant-ish time: always run verifyPassword even when the user is
    // missing, against a throwaway hash, to mask the existence check.
    const hash = user?.passwordHash ?? '$argon2id$v=19$m=19456,t=2,p=1$YWFhYWFhYWFhYWFhYWFhYQ$0000000000000000000000000000000000000000000';
    const ok = await verifyPassword(hash, password);
    if (!user || !ok) {
      res.status(401).json({ error: 'invalid_credentials' });
      return;
    }
    const token = signToken({ sub: user.id, email: user.email });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, settings: user.settings, defaultPassword: user.defaultPassword } });
  } catch (err) {
    next(err);
  }
});
