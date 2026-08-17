# Contexto IA — `/mnt/docker-services/LifeBusinessSuit/MoneyAPP`

> Gerado automaticamente. Inclui estrutura + conteúdo de arquivos-chave.
> Use este documento como contexto para desenvolvimento (PWA, features, etc.).

---

**Caminho analisado:** `/mnt/docker-services/LifeBusinessSuit/MoneyAPP`  
**Sub-grupos encontrados:** 20

**Sinais PWA:** service worker presente, vite.config encontrado

---

## 📁 Estrutura

### `Raiz do projeto`
- **Tipo:** `docker-compose`
- **Path:** `/mnt/docker-services/LifeBusinessSuit/MoneyAPP`
- **Pastas:** `.githooks`, `.vscode`, `apps`, `packages`
- **Arquivos-chave:**
  - `CHANGELOG.md`
  - `README.md`
  - `docker-compose.yml`
  - `package.json`
  - `pnpm-workspace.yaml`
  - `tsconfig.base.json`

### `.githooks`
- **Tipo:** `unknown`
- **Path:** `/mnt/docker-services/LifeBusinessSuit/MoneyAPP/.githooks`
- **Arquivos-chave:**
  - `README.md`

### `apps`
- **Tipo:** `unknown`
- **Path:** `/mnt/docker-services/LifeBusinessSuit/MoneyAPP/apps`
- **Pastas:** `backend`, `bot`, `frontend`

### `apps/backend`
- **Tipo:** `node-typescript-app`
- **Path:** `/mnt/docker-services/LifeBusinessSuit/MoneyAPP/apps/backend`
- **Pastas:** `src`
- **Arquivos-chave:**
  - `Dockerfile`
  - `package.json`
  - `tsconfig.json`

### `apps/backend/src`
- **Tipo:** `unknown`
- **Path:** `/mnt/docker-services/LifeBusinessSuit/MoneyAPP/apps/backend/src/routes`
- **Pastas:** `middleware`, `routes`
- **Arquivos-chave:**
  - `accounts.ts`
  - `app.ts`
  - `auth.ts`
  - `bot.ts`
  - `calendar.ts`
  - `categories.ts`
  - `dashboard.ts`
  - `index.ts`
  - `investments.ts`
  - `loans.ts`
  - `push.ts`
  - `server.ts`
  - `shares.ts`
  - `subscriptions.ts`
  - `transactions.ts`
  - `users.ts`
  - `validate.ts`

### `apps/bot`
- **Tipo:** `node-typescript-app`
- **Path:** `/mnt/docker-services/LifeBusinessSuit/MoneyAPP/apps/bot`
- **Pastas:** `src`
- **Arquivos-chave:**
  - `.env.example`
  - `Dockerfile`
  - `README.md`
  - `package.json`
  - `test-ollama.ts`
  - `tsconfig.json`

### `apps/bot/src`
- **Tipo:** `unknown`
- **Path:** `/mnt/docker-services/LifeBusinessSuit/MoneyAPP/apps/bot/src/vendor/api-client`
- **Pastas:** `api-client`, `cron`, `handlers`, `models`, `scenes`, `ui`, `utils`, `vendor`
- **Arquivos-chave:**
  - `account.ts`
  - `api.ts`
  - `attachReceipt.ts`
  - `auth.ts`
  - `bot.ts`
  - `category.ts`
  - `changeCategory.ts`
  - `chart.ts`
  - `client.ts`
  - `common.ts`
  - `config.ts`
  - `context.ts`
  - `dashboard.ts`
  - `format.ts`
  - `icons.ts`
  - `index.ts`
  - `investment.ts`
  - `investments.ts`
  - `loan.ts`
  - `loans.ts`
  - `login.ts`
  - `notifications.ts`
  - `register.ts`
  - `reports.ts`
  - `scanReceipt.ts`
  - `shares.ts`
  - `start.ts`
  - `subscription.ts`
  - `transaction.ts`
  - `upcoming.ts`
  - `user-cache.ts`
  - `viewCategory.ts`
  - `voice.ts`

### `apps/frontend`
- **Tipo:** `vue-frontend`
- **Path:** `/mnt/docker-services/LifeBusinessSuit/MoneyAPP/apps/frontend`
- **Pastas:** `public`, `src`
- **Arquivos-chave:**
  - `Dockerfile`
  - `index.html`
  - `nginx.conf`
  - `package.json`
  - `postcss.config.js`
  - `tailwind.config.ts`
  - `tsconfig.json`
  - `vite.config.ts`

### `apps/frontend/public`
- **Tipo:** `unknown`
- **Path:** `/mnt/docker-services/LifeBusinessSuit/MoneyAPP/apps/frontend/public`
- **Pastas:** `banks`, `logo`, `logos_bancarios`
- **Arquivos-chave:**
  - `sw.js`

### `apps/frontend/src`
- **Tipo:** `vue-frontend`
- **Path:** `/mnt/docker-services/LifeBusinessSuit/MoneyAPP/apps/frontend/src/stores`
- **Pastas:** `assets`, `components`, `composables`, `dashboard`, `modals`, `stores`, `styles`, `utils`, `views`
- **Arquivos-chave:**
  - `AccountsView.vue`
  - `App.vue`
  - `AppShell.vue`
  - `CategoriesView.vue`
  - `ConfirmPaymentModal.vue`
  - `CreditCardsView.vue`
  - `DashboardAccounts.vue`
  - `DashboardCategories.vue`
  - `DashboardCreditCards.vue`
  - `DashboardKPIs.vue`
  - `DashboardMensalidades.vue`
  - `DashboardUpcoming.vue`
  - `DashboardView.vue`
  - `DateSelectionModal.vue`
  - `EmptyState.vue`
  - `GlobalConfirmDialog.vue`
  - `InvestmentModal.vue`
  - `InvestmentsView.vue`
  - `LinkTransactionModal.vue`
  - `LoanModal.vue`
  - `LoansView.vue`
  - `LoginView.vue`
  - `Modal.vue`
  - `NewAccountModal.vue`
  - `NewCategoryModal.vue`
  - `NewTransactionModal.vue`
  - `PayInvoiceModal.vue`
  - `PiggyBankDetails.vue`
  - `RecurrentsView.vue`
  - `ReportsView.vue`
  - `SettingsView.vue`
  - `SetupPasswordView.vue`
  - `SharedView.vue`
  - `SubscriptionModal.vue`
  - `TransactionDetailsModal.vue`
  - `TransactionsView.vue`
  - `auth.ts`
  - `date.ts`
  - `investments.ts`
  - `main.ts`
  - `router.ts`
  - `sw.js`
  - `useConfirmDialog.ts`
  - `usePush.ts`

### `packages`
- **Tipo:** `unknown`
- **Path:** `/mnt/docker-services/LifeBusinessSuit/MoneyAPP/packages`
- **Pastas:** `api-client`, `db`, `models`, `services`

### `packages/api-client`
- **Tipo:** `node-typescript-app`
- **Path:** `/mnt/docker-services/LifeBusinessSuit/MoneyAPP/packages/api-client`
- **Pastas:** `src`
- **Arquivos-chave:**
  - `package.json`
  - `tsconfig.json`

### `packages/api-client/src`
- **Tipo:** `unknown`
- **Path:** `/mnt/docker-services/LifeBusinessSuit/MoneyAPP/packages/api-client/src`
- **Arquivos-chave:**
  - `client.ts`
  - `index.ts`
  - `investments.ts`
  - `push.ts`
  - `shares.ts`

### `packages/db`
- **Tipo:** `node-typescript-app`
- **Path:** `/mnt/docker-services/LifeBusinessSuit/MoneyAPP/packages/db`
- **Pastas:** `drizzle`, `src`
- **Arquivos-chave:**
  - `drizzle.config.ts`
  - `package.json`
  - `query.ts`
  - `tsconfig.json`

### `packages/db/drizzle`
- **Tipo:** `unknown`
- **Path:** `/mnt/docker-services/LifeBusinessSuit/MoneyAPP/packages/db/drizzle`
- **Pastas:** `meta`
- **Arquivos-chave:**
  - `0000_numerous_pete_wisdom.sql`
  - `0001_overjoyed_gargoyle.sql`
  - `0002_absent_amphibian.sql`
  - `0003_military_dark_phoenix.sql`
  - `0004_lucky_sabra.sql`
  - `0005_safe_lester.sql`
  - `0006_fine_green_goblin.sql`
  - `0007_hesitant_morph.sql`
  - `0008_drop_calendar_sync_token.sql`
  - `0009_tense_stature.sql`
  - `0010_loose_jackal.sql`
  - `0011_alter_loginhub_id.sql`
  - `0011_majestic_gabe_jones.sql`
  - `0012_drop_user_id.sql`
  - `0012_marvelous_salo.sql`
  - `0013_clean_nulls.sql`
  - `0013_harsh_steve_rogers.sql`
  - `0014_delete_invalid_users.sql`
  - `0014_link_invoice_payment.sql`

### `packages/db/src`
- **Tipo:** `unknown`
- **Path:** `/mnt/docker-services/LifeBusinessSuit/MoneyAPP/packages/db/src`
- **Arquivos-chave:**
  - `client.ts`
  - `index.ts`
  - `migrate.ts`
  - `schema.ts`

### `packages/models`
- **Tipo:** `node-typescript-app`
- **Path:** `/mnt/docker-services/LifeBusinessSuit/MoneyAPP/packages/models`
- **Pastas:** `src`
- **Arquivos-chave:**
  - `package.json`
  - `tsconfig.json`

### `packages/models/src`
- **Tipo:** `unknown`
- **Path:** `/mnt/docker-services/LifeBusinessSuit/MoneyAPP/packages/models/src`
- **Arquivos-chave:**
  - `account.ts`
  - `auth.ts`
  - `category.ts`
  - `common.ts`
  - `dashboard.ts`
  - `index.ts`
  - `investment.ts`
  - `loan.ts`
  - `push.ts`
  - `subscription.ts`
  - `transaction.ts`

### `packages/services`
- **Tipo:** `node-typescript-app`
- **Path:** `/mnt/docker-services/LifeBusinessSuit/MoneyAPP/packages/services`
- **Pastas:** `src`
- **Arquivos-chave:**
  - `package.json`
  - `tsconfig.json`

### `packages/services/src`
- **Tipo:** `unknown`
- **Path:** `/mnt/docker-services/LifeBusinessSuit/MoneyAPP/packages/services/src/config`
- **Pastas:** `config`
- **Arquivos-chave:**
  - `categories.ts`
  - `env.ts`
  - `index.ts`
  - `investments.ts`

---

## 📄 Conteúdo dos arquivos-chave

### `Raiz do projeto`

#### `docker-compose.yml`

```yaml
# =============================================================================
# MoneyAPP — only application services. PostgreSQL is intentionally OMITTED:
# we attach to the pre-existing `awlsrvDB_postgres` container via the shared
# external network `awl_network`.
#
# Prereq (one-time, run on the host if it does not exist):
#   docker network inspect awl_network >/dev/null 2>&1 || \
#     docker network create awl_network
#
# Run from this directory:
#   docker compose --env-file .env up -d --build
# =============================================================================

services:
  lbs_moneyapp_backend:
    build:
      context: .
      dockerfile: apps/backend/Dockerfile
    container_name: lbs_moneyapp_backend
    env_file:
    - ../shared.env
    - .env
    environment:
      NODE_ENV: production
      PORT: 3000
      # DATABASE_URL montado a partir do DB_DSN (../shared.env) + DB_NAME (.env).
      DATABASE_URL: "${DB_DSN:?defina DB_DSN em ../shared.env}/${DB_NAME:?defina DB_NAME no .env do app}"
    networks:
      awl_network:
        aliases:
        - moneyapp_backend
    expose:
    - "3000"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://localhost:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 20s

  lbs_moneyapp_frontend:
    build:
      context: .
      dockerfile: apps/frontend/Dockerfile
      args:
        VITE_API_BASE_URL: ${VITE_API_BASE_URL}
        VITE_LOGINHUB_API_URL: ${VITE_LOGINHUB_API_URL}
        VITE_LOGINHUB_APP_ID: ${VITE_LOGINHUB_APP_ID}
    container_name: lbs_moneyapp_frontend
    depends_on:
      lbs_moneyapp_backend:
        condition: service_healthy
    networks:
      awl_network:
        aliases:
        - moneyapp_frontend
    restart: unless-stopped

  lbs_moneyapp_bot:
    build:
      context: apps/bot
      dockerfile: Dockerfile
    container_name: lbs_moneyapp_bot
    env_file:
    # Mesmo par de env_file dos outros serviços: infra comum no shared (NODE_ENV,
    # BOT_SERVICE_KEY, GROQ_API_KEY, OLLAMA_URL) + o .env do app, que traz
    # TELEGRAM_BOT_TOKEN, LOGINHUB_* e os modelos OLLAMA_*. Antes o bot lia um
    # .env próprio quando vivia numa subpasta separada — unificado para haver UM
    # só .env.
    - ../shared.env
    - .env
    environment:
      NODE_ENV: production
      # Fonte única do BACKEND_URL (precede env_file). `moneyapp_backend` é o
      # alias de rede do serviço lbs_moneyapp_backend.
      BACKEND_URL: http://moneyapp_backend:3000/api
    depends_on:
      lbs_moneyapp_backend:
        condition: service_healthy
    networks:
      awl_network:
        aliases:
        - telegram_moneyapp_bot
    restart: unless-stopped

networks:
  # External — already exists on the host alongside `awlsrvDB_postgres`.
  # NOTE: the brief mentioned `awlsrv_network`, but the real network name on
  # this host (verified via `docker inspect awlsrvDB_postgres`) is `awl_network`.
  awl_network:
    external: true
```

#### `package.json`

```json
{
  "name": "moneyapp",
  "version": "0.1.0",
  "private": true,
  "description": "PWA de controle financeiro pessoal — monorepo Vue 3 + Express + Drizzle + PostgreSQL",
  "packageManager": "pnpm@9.0.0",
  "engines": {
    "node": ">=20.10.0"
  },
  "scripts": {
    "dev": "pnpm -r --parallel run dev",
    "build": "pnpm -r run build",
    "lint": "pnpm -r run lint",
    "typecheck": "pnpm -r run typecheck",
    "db:generate": "pnpm --filter @moneyapp/backend run db:generate",
    "db:migrate": "pnpm --filter @moneyapp/backend run db:migrate",
    "db:studio": "pnpm --filter @moneyapp/backend run db:studio"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "@types/node": "^20.14.0"
  }
}
```

#### `pnpm-workspace.yaml`

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

#### `tsconfig.base.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true,
    "baseUrl": ".",
    "paths": {
      "@moneyapp/shared": ["packages/shared/src/index.ts"],
      "@moneyapp/shared/*": ["packages/shared/src/*"]
    }
  }
}
```

### `apps/backend`

#### `apps/backend/Dockerfile`

```
# syntax=docker/dockerfile:1.7
# Build context is the monorepo root so workspace deps resolve correctly.

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /repo

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* tsconfig.base.json ./
COPY apps/backend/package.json apps/backend/
COPY packages/models/package.json packages/models/
COPY packages/db/package.json packages/db/
COPY packages/api-client/package.json packages/api-client/
COPY packages/services/package.json packages/services/
RUN pnpm install --frozen-lockfile || pnpm install

FROM deps AS build
COPY packages/ packages/
COPY apps/backend apps/backend
# Ensure the migrations folder exists even on the first build (it is normally
# populated by `pnpm db:generate` on the host before docker build).
RUN mkdir -p apps/backend/drizzle \
 && pnpm --filter @moneyapp/models run typecheck \
 && pnpm --filter @moneyapp/db run typecheck \
 && pnpm --filter @moneyapp/api-client run typecheck \
 && pnpm --filter @moneyapp/services run typecheck \
 && pnpm --filter @moneyapp/backend run typecheck

# Runtime image runs `tsx` directly against TypeScript sources — avoids the
# NodeNext-ESM `.js` extension dance and keeps the image close to dev parity.
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
COPY --from=build /repo/package.json /repo/pnpm-workspace.yaml /repo/tsconfig.base.json ./
COPY --from=build /repo/packages/ packages/
COPY --from=build /repo/apps/backend apps/backend
RUN pnpm install --prod --frozen-lockfile || pnpm install --prod
EXPOSE 3000
WORKDIR /app/apps/backend
CMD ["pnpm", "start"]
```

#### `apps/backend/package.json`

```json
{
  "name": "@moneyapp/backend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/server.js",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc --noEmit",
    "start": "tsx src/server.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@moneyapp/models": "workspace:*",
    "@moneyapp/db": "workspace:*",
    "@moneyapp/services": "workspace:*",
    "argon2": "^0.40.3",
    "cors": "^2.8.5",
    "ics": "^3.7.2",
    "dotenv": "^16.4.5",
    "drizzle-orm": "^0.33.0",
    "express": "^4.19.2",
    "helmet": "^7.1.0",
    "jsonwebtoken": "^9.0.2",
    "pino": "^9.3.2",
    "pino-http": "^10.2.0",
    "tsx": "^4.16.2",
    "web-push": "^3.6.7",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/jsonwebtoken": "^9.0.6",
    "@types/node": "^20.14.0",
    "@types/web-push": "^3.6.3",
    "typescript": "^5.5.0"
  }
}
```

#### `apps/backend/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "types": ["node"]
  },
  "include": ["src/**/*.ts"]
}
```

### `apps/bot`

#### `apps/bot/.env.example`

```json
# MoneyAPP bot — variáveis lidas e validadas por src/config.ts (zod).
#
# NÃO copie para um .env aqui: desde 07/2026 o bot não tem .env próprio. O
# docker-compose do MoneyAPP carrega `env_file: [../shared.env, .env]` nos três
# serviços, então estas variáveis vão para:
#   • MoneyAPP/.env          -> TELEGRAM_BOT_TOKEN, LOGINHUB_*, OLLAMA_MODEL,
#                               OLLAMA_TEXT_MODEL
#   • LifeBusinessSuit/shared.env -> NODE_ENV, BOT_SERVICE_KEY, GROQ_API_KEY,
#                               OLLAMA_URL  (comuns a todos os apps)
#   • docker-compose.yml (environment:) -> BACKEND_URL
#
# Este arquivo fica só como referência do que o config.ts exige. Um .env criado
# neste diretório é ignorado pelo compose (e pelo .dockerignore) — não teria efeito.

NODE_ENV=production

# Token do bot no @BotFather.
TELEGRAM_BOT_TOKEN=123456789:AA-troque-pelo-token-real

# DEVE ser idêntico à chave de serviço do backend (o bot a usa para autenticar).
BOT_SERVICE_KEY=troque-por-uma-chave-igual-ao-do-backend-min-32-chars

# URL da API do LoginHub, usada para autenticação de usuários
LOGINHUB_API_URL=http://server_loginhub_backend:3000/api
# ID deste app (MoneyAPP) no LoginHub — evita AMBIGUOUS_EMAIL no login
LOGINHUB_APP_ID=3
# -----------------------------------------------------------------------------
# Ollama Vision Configuration
# -----------------------------------------------------------------------------
# URL do servidor Ollama (via rede docker awl_network)
OLLAMA_URL=http://server_ollama:11434
# Modelo utilizado para o OCR (deve ter suporte a visão)
OLLAMA_MODEL=qwen2.5vl:7b
# Modelo utilizado para a transação por voz (texto puro, sem visão)
OLLAMA_TEXT_MODEL=llama3.1

# ==========================================
# 🎤 GROQ API (Transcrição de voz)
# ==========================================
GROQ_API_KEY=gsk_xyz123

# URL do backend na awl_network. Em produção é injetado pelo docker-compose;
# para rodar localmente, aponte para onde o backend estiver.
BACKEND_URL=http://moneyapp_backend:3000/api
```

#### `apps/bot/Dockerfile`

```
# syntax=docker/dockerfile:1.7
# MoneyAPP bot — single-package (sem monorepo). Runtime roda `tsx` direto no TS
# (paridade dev/prod). Os antigos workspace deps (@moneyapp/api-client e
# @moneyapp/models) foram vendorizados em src/vendor e resolvidos via tsconfig
# `paths` — por isso o tsconfig.json é copiado também no estágio runtime.

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install

FROM deps AS build
COPY tsconfig.json ./
COPY src ./src
RUN pnpm run typecheck

# ttf-dejavu + fontconfig: o sharp/libvips usa fontes do sistema para renderizar
# o texto dos gráficos de pizza (SVG -> PNG em src/utils/chart.ts).
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate \
 && apk add --no-cache ttf-dejavu fontconfig
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --prod --frozen-lockfile || pnpm install --prod
COPY tsconfig.json ./
COPY src ./src
CMD ["pnpm", "start"]
```

#### `apps/bot/package.json`

```json
{
  "name": "@moneyapp/bot",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "description": "Bot de Telegram do MoneyAPP — cliente HTTP do backend (extraído do monorepo MoneyAPP).",
  "packageManager": "pnpm@9.0.0",
  "engines": {
    "node": ">=20.10.0"
  },
  "scripts": {
    "start": "tsx src/index.ts",
    "dev": "tsx watch src/index.ts",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "dotenv": "^16.4.5",
    "node-cron": "^4.2.1",
    "sharp": "^0.33.5",
    "telegraf": "^4.16.3",
    "tsx": "^4.16.2",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "@types/node-cron": "^3.0.11",
    "typescript": "^5.5.0"
  }
}
```

#### `apps/bot/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true,
    "types": ["node"],
    "outDir": "dist",
    "baseUrl": ".",
    "paths": {
      "@moneyapp/api-client": ["src/vendor/api-client/index.ts"],
      "@moneyapp/models": ["src/vendor/models/index.ts"]
    }
  },
  "include": ["src/**/*.ts"]
}
```

### `apps/frontend`

#### `apps/frontend/Dockerfile`

```
# syntax=docker/dockerfile:1.7
ARG VITE_API_BASE_URL
ARG VITE_LOGINHUB_API_URL
ARG VITE_LOGINHUB_APP_ID

FROM node:20-alpine AS build
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /repo
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* tsconfig.base.json ./
COPY apps/frontend/package.json apps/frontend/
COPY packages/models/package.json packages/models/
COPY packages/db/package.json packages/db/
COPY packages/api-client/package.json packages/api-client/
COPY packages/services/package.json packages/services/
RUN pnpm install --frozen-lockfile || pnpm install
COPY packages/ packages/
COPY apps/frontend apps/frontend
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ARG VITE_LOGINHUB_API_URL
ENV VITE_LOGINHUB_API_URL=$VITE_LOGINHUB_API_URL
ARG VITE_LOGINHUB_APP_ID
ENV VITE_LOGINHUB_APP_ID=$VITE_LOGINHUB_APP_ID
RUN pnpm --filter @moneyapp/frontend run build

FROM nginx:1.27-alpine AS runtime
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/frontend/dist /usr/share/nginx/html
EXPOSE 80
```

#### `apps/frontend/index.html`

```html
<!doctype html>
<html lang="pt-BR" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#0b0f17" />
    <title>MoneyAPP</title>
    <link rel="icon" href="/logo/MONEYAPP.png" type="image/png" />
    <link rel="apple-touch-icon" href="/logo/pwa-192x192.png" />
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  </head>
  <body class="bg-surface-base text-slate-100 antialiased">
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

#### `apps/frontend/nginx.conf`

```nginx
server {
  listen 80;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;

  # The service worker and the HTML shell must NEVER be cached as immutable,
  # otherwise clients get stuck on a stale build until a manual hard-reload.
  # They are tiny and always revalidated against the server.
  location = /sw.js {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
    expires off;
  }
  location = /index.html {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
    expires off;
  }

  # SPA fallback — let the Vue Router handle unknown paths.
  location / {
    try_files $uri $uri/ /index.html;
  }

  # Proxy /api to the backend service over the shared awl_network.
  location /api/ {
    resolver 127.0.0.11 valid=30s;
    set $backend_upstream http://moneyapp_backend:3000;
    proxy_pass         $backend_upstream;
    proxy_http_version 1.1;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Real-IP         $remote_addr;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
    client_max_body_size 30m;
  }

  # Only the hashed build bundles (content-hash in the filename) are safe to
  # cache forever — their URL changes whenever the content changes.
  location /assets/ {
    expires 1y;
    access_log off;
    add_header Cache-Control "public, max-age=31536000, immutable";
  }
}
```

#### `apps/frontend/package.json`

```json
{
  "name": "@moneyapp/frontend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "typecheck": "vue-tsc --noEmit",
    "lint": "eslint . --ext .ts,.vue"
  },
  "dependencies": {
    "@heroicons/vue": "^2.2.0",
    "@moneyapp/api-client": "workspace:*",
    "@moneyapp/models": "workspace:*",
    "@vuepic/vue-datepicker": "^13.0.0",
    "@vueuse/core": "^14.3.0",
    "chart.js": "^4.4.0",
    "pinia": "^2.2.0",
    "vue": "^3.5.0",
    "vue-router": "^4.4.0",
    "vue-chartjs": "^5.3.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.1.2",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.41",
    "tailwindcss": "^3.4.10",
    "typescript": "^5.5.0",
    "vite": "^5.4.0",
    "vite-plugin-pwa": "^0.20.1",
    "vue-tsc": "^2.0.29"
  }
}
```

#### `apps/frontend/tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "preserve",
    "types": ["vite/client"]
  },
  "include": ["src/**/*.ts", "src/**/*.vue", "vite.config.ts"]
}
```

#### `apps/frontend/vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectRegister: false,
      injectManifest: {
        injectionPoint: undefined,
      },
      manifest: {
        name: 'MoneyAPP',
        short_name: 'MoneyAPP',
        theme_color: '#0b0f17',
        background_color: 'transparent',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/logo/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/logo/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/logo/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['vue', 'vue-router', 'pinia', '@vueuse/core'],
        }
      }
    }
  },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3000' },
  },
});
```

### `apps/frontend/public`

#### `apps/frontend/public/sw.js`

```javascript
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))));
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = { title: 'MoneyAPP', body: '', url: '/' };
  try {
    data = { ...data, ...event.data?.json() };
  } catch {
    // payload não-JSON
  }

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(data.title, {
        body: data.body,
        icon: '/logo/icon-192.png',
        badge: '/logo/icon-192.png',
        data: { url: data.url },
        tag: `moneyapp-${Date.now()}`,
      });

      if (typeof data.badge === 'number' && self.navigator.setAppBadge) {
        try {
          if (data.badge > 0) await self.navigator.setAppBadge(data.badge);
          else await self.navigator.clearAppBadge();
        } catch {}
      }

      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) client.postMessage({ type: 'new-notification', url: data.url });
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        if ('focus' in client) {
          await client.focus();
          return;
        }
      }
      await self.clients.openWindow(url);
    })()
  );
});
```

### `apps/frontend/src`

#### `apps/frontend/src/App.vue`

```vue
<script setup lang="ts">
import { RouterView } from 'vue-router';
</script>

<template>
  <div class="min-h-dvh bg-surface-base relative overflow-hidden">
    <!-- Ambient background blobs (estáticos: a animação contínua forçava
         os cards com backdrop-filter a re-borrar o fundo a cada frame). -->
    <div class="absolute top-0 -left-4 w-72 h-72 bg-primary-soft rounded-full filter blur-3xl opacity-30"></div>
    <div class="absolute top-0 -right-4 w-72 h-72 bg-accent-soft rounded-full filter blur-3xl opacity-30"></div>
    <div class="absolute -bottom-8 left-20 w-72 h-72 bg-brand-500/20 rounded-full filter blur-3xl opacity-30"></div>
    
    <div class="relative z-10 h-full">
      <RouterView v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </RouterView>
    </div>
  </div>
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 180ms cubic-bezier(0.22, 1, 0.36, 1);
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
```

#### `apps/frontend/src/main.ts`

```typescript
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './router';
import './styles/main.css';

import { setupApi } from '@moneyapp/api-client';
import { useAuthStore } from './stores/auth';

const pinia = createPinia();
const app = createApp(App);

app.use(pinia).use(router).mount('#app');

setupApi({
  baseUrl: import.meta.env.VITE_API_BASE_URL as string,
  getToken: () => useAuthStore().token,
  // Em 401, tenta renovar o JWT via LoginHub /auth/refresh (grace de 7 dias)
  // antes de derrubar a sessão. Se renovar com sucesso, a request original
  // é retried transparentemente.
  tryRefresh: () => useAuthStore().refresh(),
  // Sem token não há sessão a derrubar (ex.: 401 antes do login) — deixa o
  // erro propagar. Com token, derruba a sessão E redireciona: sem o push o
  // usuário ficava na tela atual com todas as chamadas falhando.
  onUnauthorized: () => {
    const auth = useAuthStore();
    if (!auth.token) return;
    auth.logout();
    void router.push({ name: 'login' });
  },
});


if ('serviceWorker' in navigator) {
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.error('Falha ao registrar service worker:', err);
      });
    });
  }
}
```

#### `apps/frontend/src/router.ts`

```typescript
import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from './stores/auth';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login',       name: 'login',        component: () => import('./views/LoginView.vue'), meta: { public: true } },
    { path: '/setup-password', name: 'setup_password', component: () => import('./views/SetupPasswordView.vue'), meta: { public: true } },
    { path: '/',            name: 'dashboard',    component: () => import('./views/DashboardView.vue') },
    { path: '/transacoes',  name: 'transactions', component: () => import('./views/TransactionsView.vue') },
    { path: '/recorrentes', name: 'recurrents',   component: () => import('./views/RecurrentsView.vue') },
    { path: '/emprestimos/:type', name: 'loans',  component: () => import('./views/LoansView.vue'), props: true },
    { path: '/contas',      name: 'accounts',     component: () => import('./views/AccountsView.vue') },
    { path: '/categorias',  name: 'categories',   component: () => import('./views/CategoriesView.vue') },
    { path: '/cartoes',     name: 'credit_cards', component: () => import('./views/CreditCardsView.vue') },
    { path: '/investimentos', name: 'investments', component: () => import('./views/InvestmentsView.vue') },
    { path: '/relatorios',  name: 'reports',      component: () => import('./views/ReportsView.vue') },
    { path: '/configuracoes', name: 'settings',   component: () => import('./views/SettingsView.vue') },
    { path: '/share/:token',  name: 'shared_view', component: () => import('./views/SharedView.vue'), meta: { public: true } },
  ],
});

router.beforeEach((to) => {
  const auth = useAuthStore();
  if (to.meta.public) return true;
  if (!auth.isAuthenticated) {
    return { name: 'login', query: { next: to.fullPath } };
  }
  return true;
});
```

#### `apps/frontend/src/sw.js`

```javascript
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))));
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = { title: 'MoneyAPP', body: '', url: '/' };
  try {
    data = { ...data, ...event.data?.json() };
  } catch {
    /* payload não-JSON — usa defaults */
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/logo/pwa-192x192.png',
      badge: '/logo/pwa-192x192.png',
      data: { url: data.url },
      tag: `moneyapp-${Date.now()}`,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        if ('focus' in client) {
          await client.focus();
          return;
        }
      }
      await self.clients.openWindow(url);
    })()
  );
});
```

### `packages/api-client`

#### `packages/api-client/package.json`

```json
{
  "name": "@moneyapp/api-client",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "@moneyapp/models": "workspace:*"
  }
}
```

#### `packages/api-client/tsconfig.json`

```json
{"extends": "../../tsconfig.base.json","compilerOptions": {"outDir": "dist", "declaration": true}}
```

### `packages/db`

#### `packages/db/drizzle.config.ts`

```typescript
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL as string,
  },
});
```

#### `packages/db/package.json`

```json
{
  "name": "@moneyapp/db",
  "version": "0.1.0",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:push": "drizzle-kit push",
    "db:migrate": "tsx src/migrate.ts",
    "db:studio": "drizzle-kit studio",
    "build": "tsc",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "drizzle-orm": "^0.33.0",
    "pg": "^8.11.3",
    "postgres": "^3.4.4",
    "dotenv": "^16.4.5",
    "tsx": "^4.16.2"
  },
  "devDependencies": {
    "@types/pg": "^8.11.2",
    "drizzle-kit": "^0.24.0",
    "typescript": "^5.5.0"
  }
}
```

#### `packages/db/tsconfig.json`

```json
{"extends": "../../tsconfig.base.json","compilerOptions": {"outDir": "dist", "declaration": true}}
```

### `packages/models`

#### `packages/models/package.json`

```json
{
  "name": "@moneyapp/models",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "zod": "^3.23.8"
  }
}
```

#### `packages/models/tsconfig.json`

```json
{"extends": "../../tsconfig.base.json","compilerOptions": {"outDir": "dist", "declaration": true}}
```

### `packages/services`

#### `packages/services/package.json`

```json
{
  "name": "@moneyapp/services",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "@moneyapp/models": "workspace:*",
    "@moneyapp/db": "workspace:*",
    "drizzle-orm": "^0.33.0",
    "dotenv": "^16.4.5",
    "jsonwebtoken": "^9.0.2",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/jsonwebtoken": "^9.0.6"
  }
}
```

#### `packages/services/tsconfig.json`

```json
{"extends": "../../tsconfig.base.json","compilerOptions": {"outDir": "dist", "declaration": true}}
```

---

*Fim do contexto.*