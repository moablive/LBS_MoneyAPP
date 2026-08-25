import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  // Shared with LoginHub: requireAuth verifies LoginHub-issued user JWTs with
  // this secret. shares.ts also signs/verifies its own share-link tokens with it.
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 chars'),
  // ID do MoneyAPP no LoginHub. Obrigatório: `requireAuth` recusa token de
  // outro tenant, e sem esse id não há como delimitar o escopo — um JWT
  // assinado para qualquer outro app do hub passaria por aqui.
  LOGINHUB_APP_ID: z.coerce.number().int().positive(),
  /**
   * API interna do hub — usada pela introspeccao de revogacao de sessao
   * (`GET /auth/session-floor`). DNS do Docker, sem sair para o Cloudflare.
   */
  LOGINHUB_API_URL: z.string().default('http://server_loginhub_backend:3000/api'),
  // Shared secret the Telegram bot presents (x-api-key) to call /bot/* routes.
  BOT_SERVICE_KEY: z.string().min(32, 'BOT_SERVICE_KEY must be at least 32 chars'),
  /**
   * Username do bot, sem `@` — entra no deep link do vinculo hibrido
   * (`https://t.me/<username>?start=<passe>`). Opcional: sem ele o app segue
   * inteiro, so a rota `/api/telegram/link-token` responde CONFIG_AUSENTE.
   */
  TELEGRAM_BOT_USERNAME: z.string().optional(),
  CORS_ORIGIN: z.string().default('*').transform((val) => {
    if (val === '*') return val;
    return val.split(',').map(s => s.trim());
  }),
  MAX_RECEIPT_BYTES: z.coerce.number().int().positive().default(5 * 1024 * 1024),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default('mailto:admin@moneyapp.local'),
  OLLAMA_URL: z.string().default('http://server_ollama:11434'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
