import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'TELEGRAM_BOT_TOKEN is required'),
  BACKEND_URL: z.string().url().default('http://localhost:3000'),
  // Central identity provider (LoginHub). The bot validates user credentials here.
  LOGINHUB_API_URL: z.string().url(),
  // ID do MoneyAPP no LoginHub (tenant). Enviado em /auth/login para evitar
  // AMBIGUOUS_EMAIL quando o mesmo e-mail existe em mais de um app.
  LOGINHUB_APP_ID: z.string().min(1).optional(),
  // Shared service key presented to the MoneyAPP backend on /bot/* and on
  // delegated user routes (with the x-user-id header). Replaces the old
  // self-signed JWT (JWT_SECRET) — the bot no longer mints tokens.
  BOT_SERVICE_KEY: z.string().min(32, 'BOT_SERVICE_KEY must be at least 32 chars'),
  OLLAMA_URL: z.string().url().default('http://server_ollama:11434'),
  // Modelo de visão (OCR de comprovantes) — precisa suportar imagens.
  OLLAMA_MODEL: z.string().default('qwen2.5vl:7b'),
  // Modelo de texto (transação por voz) — não precisa de visão.
  OLLAMA_TEXT_MODEL: z.string().default('llama3.1'),
  GROQ_API_KEY: z.string().min(1, 'GROQ_API_KEY is required'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('[bot] Ambiente inválido:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
