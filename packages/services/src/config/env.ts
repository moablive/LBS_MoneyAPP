import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 chars'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  PASSWORD_HASH_ROUNDS: z.coerce.number().int().min(8).max(15).default(12),
  CORS_ORIGIN: z.string().default('*').transform((val) => {
    if (val === '*') return val;
    return val.split(',').map(s => s.trim());
  }),
  MAX_RECEIPT_BYTES: z.coerce.number().int().positive().default(5 * 1024 * 1024),
  // Master user — set MASTER_USER_EMAIL='' to disable the startup bootstrap.
  MASTER_USER_EMAIL: z
    .string()
    .transform((v) => v.trim().toLowerCase())
    .pipe(z.union([z.literal(''), z.string().email().max(255)]))
    .optional(),
  MASTER_USER_NAME: z.string().trim().min(1).max(120).default('Master'),
  MASTER_USER_PASSWORD: z.string().min(10).max(128).optional(),
}).passthrough(); // Allow other MASTER_USER_N keys to pass through for dynamic discovery

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
