import 'dotenv/config';
import { z } from 'zod';

// z.coerce.boolean() trata QUALQUER string nao-vazia como true ("false" -> true).
// Aqui a leitura e explicita: so 1/true/yes/on (case-insensitive) contam como
// verdadeiro; qualquer outra coisa, ou ausencia, cai no padrao informado.
const boolEnv = (padrao: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined ? padrao : /^(1|true|yes|on)$/i.test(v.trim())));

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
   * Consumidores de servico confiaveis (identidade delegada por `x-user-id`).
   * Formato: `<id>:<segredo>:<escopo1,escopo2>;<id2>:...`. Ex.:
   * `todoapp:<segredo>:calendar.read,receipt.read`. Vazio = um unico consumidor
   * `internal` com o proprio BOT_SERVICE_KEY (reaproveita a chave atual).
   */
  MONEYAPP_CONSUMERS: z.string().optional(),
  /**
   * Mantem o ramo LEGADO do `requireAuth` (x-api-key + x-user-id confiado cego).
   * `true` enquanto o bot ainda nao repassa JWT do LoginHub; vira `false` para
   * FECHAR de vez a delegacao cega — o buraco de ler/escrever qualquer conta so
   * com a chave. Ver middleware/auth.ts e middleware/consumers.ts.
   */
  ALLOW_LEGACY_BOT_DELEGATION: boolEnv(true),
  /**
   * Exige consentimento do dono (user_settings.leitoresExternos) na leitura
   * cross-app escopada. SEPARADO de ALLOW_LEGACY_BOT_DELEGATION de proposito:
   * fechar o ramo cego do bot nao deve forcar o seed nem quebrar o TodoAPP.
   * Ligue depois de semear os consentimentos.
   */
  ENFORCE_CONSUMER_CONSENT: boolEnv(false),
  /**
   * Escape hatch: aceitar chave de servico vinda da borda publica. Fica `false`
   * — so ligar se a topologia mudar (algum chamador legitimo passar a entrar
   * pelo nginx do frontend). Ver middleware/rede.ts.
   */
  TRUST_EDGE_SERVICE_KEY: boolEnv(false),
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
