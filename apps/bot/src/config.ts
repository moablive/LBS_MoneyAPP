import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'TELEGRAM_BOT_TOKEN is required'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  BACKEND_URL: z.string().url().default('http://localhost:3000'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 chars'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('[bot] Ambiente inválido:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
