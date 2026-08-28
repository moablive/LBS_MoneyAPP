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
  // Login publico DESTE app — e para ca que o bot manda quem precisa
  // enrolar 2FA. O QR mora na propria tela do app desde que cada um
  // passou a enrolar em casa; o painel do hub saiu do caminho.
  APP_LOGIN_URL: z.string().default('https://money.astralwavelabel.com/login'),
  LOGINHUB_APP_ID: z.string().min(1).optional(),
  // Painel do hub — endereço PÚBLICO, porque vai dentro de um link que a pessoa
  // abre no navegador dela. É lá que mora a tela do QR de enrolamento de 2FA,
  // compartilhada por todos os apps; o bot não reimplementa nada disso.
  LOGINHUB_UI_URL: z.string().url().default('https://loginhub.astralwavelabel.com'),
  // Shared service key presented to the MoneyAPP backend on /bot/* and on
  // delegated user routes (with the x-user-id header). Replaces the old
  // self-signed JWT (JWT_SECRET) — the bot no longer mints tokens.
  BOT_SERVICE_KEY: z.string().min(32, 'BOT_SERVICE_KEY must be at least 32 chars'),
  // Fase 2: chave DEDICADA para pedir ao hub um JWT de usuario curto
  // (POST /auth/service/delegate). Presente => o bot repassa Bearer <jwt> ao
  // backend; ausente => cai no legado (x-api-key + x-user-id). Diferente da
  // BOT_SERVICE_KEY compartilhada do ecossistema.
  HUB_DELEGATION_KEY: z.string().optional(),
  OLLAMA_URL: z.string().url().default('http://server_ollama:11434'),
  // Modelo de visão (OCR de comprovantes) — precisa suportar imagens.
  OLLAMA_MODEL: z.string().default('qwen2.5vl:7b'),
  // Modelo de texto (transação por voz) — não precisa de visão, mas usa o MESMO
  // tag do de visão acima de propósito: em 12GB só um modelo fica residente, e
  // assim voz e comprovante não se evictam. Ver nota em ../../../shared.env.
  OLLAMA_TEXT_MODEL: z.string().default('qwen2.5vl:7b'),
  GROQ_API_KEY: z.string().min(1, 'GROQ_API_KEY is required'),
  // ── LBS Notify (plataforma central de notificacoes) ──────────────────────
  // Com a flag `false` nada muda: o cron continua so no Telegram. Ligada, ele
  // passa a emitir tambem o evento de vencimento para o Notify entregar como
  // Web Push — o Telegram continua saindo daqui do mesmo jeito.
  LBS_NOTIFY_URL: z.string().default('http://lbs_notify_api:3000'),
  LBS_NOTIFY_KEY: z.string().optional(),
  MONEY_NOTIFY_USE_CENTRAL: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? false : /^(1|true|yes|on)$/i.test(v.trim()))),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('[bot] Ambiente inválido:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
