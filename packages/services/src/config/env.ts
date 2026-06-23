import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  // Shared with LoginHub: requireAuth verifies LoginHub-issued user JWTs with
  // this secret. shares.ts also signs/verifies its own share-link tokens with it.
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 chars'),
  // Shared secret the Telegram bot presents (x-api-key) to call /bot/* routes.
  BOT_SERVICE_KEY: z.string().min(32, 'BOT_SERVICE_KEY must be at least 32 chars'),
  CORS_ORIGIN: z.string().default('*').transform((val) => {
    if (val === '*') return val;
    return val.split(',').map(s => s.trim());
  }),
  MAX_RECEIPT_BYTES: z.coerce.number().int().positive().default(5 * 1024 * 1024),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
