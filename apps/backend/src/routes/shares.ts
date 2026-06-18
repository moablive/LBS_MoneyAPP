import { Router } from 'express';
import { and, eq, gt } from 'drizzle-orm';
import { z } from 'zod';
import crypto from 'crypto';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { db, schema } from '@moneyapp/db';
const { sharedLinks, transactions } = schema;
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { env } from '@moneyapp/services';

export const sharesRouter = Router();

const createShareSchema = z.object({
  categoryId: z.string().uuid().nullable().optional(),
});

sharesRouter.post('/', requireAuth, validate(createShareSchema), async (req, res, next) => {
  try {
    const userId = req.user!.id;
    const body = req.body as z.infer<typeof createShareSchema>;

    const token = crypto.randomBytes(32).toString('hex');
    const password = crypto.randomBytes(6).toString('hex'); // 12 chars
    const passwordHash = await argon2.hash(password);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const [row] = await db
      .insert(sharedLinks)
      .values({
        userId,
        categoryId: body.categoryId ?? null,
        token,
        passwordHash,
        expiresAt,
      })
      .returning();

    res.status(201).json({ token: row!.token, password });
  } catch (err) {
    next(err);
  }
});

const verifyShareSchema = z.object({
  password: z.string(),
});

sharesRouter.post('/:token/verify', validate(verifyShareSchema), async (req, res, next) => {
  try {
    const token = req.params.token!;
    const { password } = req.body as z.infer<typeof verifyShareSchema>;

    const link = await db.query.sharedLinks.findFirst({
      where: and(eq(sharedLinks.token, token), gt(sharedLinks.expiresAt, new Date())),
    });

    if (!link) {
      res.status(404).json({ error: 'not_found_or_expired' });
      return;
    }

    const ok = await argon2.verify(link.passwordHash, password);
    if (!ok) {
      res.status(401).json({ error: 'invalid_password' });
      return;
    }

    const sessionToken = jwt.sign(
      { sub: link.userId, shareToken: token, categoryId: link.categoryId },
      env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token: sessionToken });
  } catch (err) {
    next(err);
  }
});

sharesRouter.get('/:token/transactions', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    const jwtToken = authHeader.split(' ')[1];
    if (!jwtToken) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    
    let payload: any;
    try {
      payload = jwt.verify(jwtToken, env.JWT_SECRET);
    } catch {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    const { shareToken } = payload;
    if (shareToken !== req.params.token) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    const link = await db.query.sharedLinks.findFirst({
      where: and(eq(sharedLinks.token, req.params.token), gt(sharedLinks.expiresAt, new Date())),
    });

    if (!link) {
      res.status(404).json({ error: 'not_found_or_expired' });
      return;
    }

    const conds = [eq(transactions.userId, link.userId)];
    if (link.categoryId) {
      conds.push(eq(transactions.categoryId, link.categoryId));
    }

    const rows = await db.query.transactions.findMany({
      where: and(...conds),
      columns: {
        id: true,
        description: true,
        amount: true,
        type: true,
        status: true,
        occurredAt: true,
        categoryId: true,
        accountId: true,
        createdAt: true,
        receiptBase64: true,
      },
      orderBy: (tx, { desc }) => [desc(tx.occurredAt)],
      with: {
        category: {
          columns: { name: true, color: true, type: true },
        },
        account: {
          columns: { name: true, type: true, customIconUrl: true, bankCode: true },
        }
      }
    });

    const strippedRows = rows.map(r => {
      const { receiptBase64, ...rest } = r;
      return { ...rest, hasReceipt: !!receiptBase64 };
    });

    res.json(strippedRows);
  } catch (err) {
    next(err);
  }
});

sharesRouter.get('/:token/transactions/:id/receipt', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    const jwtToken = authHeader.split(' ')[1];
    if (!jwtToken) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    
    let payload: any;
    try {
      payload = jwt.verify(jwtToken, env.JWT_SECRET);
    } catch {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    const { shareToken } = payload;
    if (shareToken !== req.params.token) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }

    const link = await db.query.sharedLinks.findFirst({
      where: and(eq(sharedLinks.token, req.params.token), gt(sharedLinks.expiresAt, new Date())),
    });

    if (!link) {
      res.status(404).json({ error: 'not_found_or_expired' });
      return;
    }

    const id = req.params.id!;
    const conds = [eq(transactions.id, id), eq(transactions.userId, link.userId)];
    if (link.categoryId) {
      conds.push(eq(transactions.categoryId, link.categoryId));
    }

    const row = await db.query.transactions.findFirst({
      where: and(...conds),
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
