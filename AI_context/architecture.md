# Architecture

## Topology

```mermaid
flowchart LR
  subgraph Client
    PWA[Vue 3 PWA<br/>Vite + Pinia + Tailwind]
  end

  TG[Telegram API]

  subgraph awl_network[Docker network: awl_network]
    NGINX[(nginx<br/>moneyapp_frontend:80)]
    API[(Express + Drizzle<br/>moneyapp_backend:3000)]
    BOT[(Telegraf<br/>moneyapp_bot)]
    PG[(awlsrvDB_postgres:5432<br/>database "moneyapp")]
  end

  PWA -- HTTPS --> NGINX
  NGINX -- /api/ --> API
  API -- pg --> PG
  TG -- long polling --> BOT
  BOT -- pg --> PG
  BOT -- /api/ --> API
```

- The PWA is served as static assets by `nginx` inside `moneyapp_frontend`.
- `nginx` reverse-proxies `/api/` to `moneyapp_backend` via internal DNS.
- The backend connects to the **existing shared Postgres** container
  `awlsrvDB_postgres` via the external Docker network `awl_network`.
- MoneyAPP uses its own dedicated Postgres **database** named `moneyapp`
  (tables in the `public` schema) on the shared `awlsrvDB_postgres` instance,
  so they don't collide with other apps.
- `moneyapp_bot` is a Telegram bot (Telegraf) that talks to Telegram via long
  polling. It accesses data primarily through the backend API using `@moneyapp/api-client`, but also connects directly to `@moneyapp/db` for user authentication and cron jobs.

## Workspaces

```text
moneyapp/
├── apps/
│   ├── frontend/            # Vue 3 PWA (Vite, Pinia, Tailwind, VitePWA)
│   │   └── src/
│   │       ├── api/          # HTTP fetch wrappers
│   │       ├── components/   # AppShell, EmptyState, Modal
│   │       │   └── modals/   # Modais de CRUD isolados (ex: NewTransactionModal)
│   │       ├── data/         # Dados estáticos (registry de bancos, etc.)
│   │       ├── stores/       # Pinia: auth, accounts, categories, transactions,
│   │       │                 #        subscriptions, investments, loans, dashboard
│   │       ├── styles/       # CSS global + design tokens
│   │       ├── views/        # LoginView, DashboardView, TransactionsView,
│   │       │                 #   RecurrentsView, AccountsView, CategoriesView,
│   │       │                 #   InvestmentsView, LoansView
│   │       ├── App.vue       # Root + route transitions
│   │       ├── main.ts       # Entrypoint
│   │       └── router.ts     # Vue Router + auth guard
│   ├── backend/             # Express + TypeScript + Drizzle + JWT
│   │   └── src/
│   │       ├── bootstrap/    # Inicialização (master user upsert)
│   │       ├── config/       # Variáveis de ambiente tipadas
│   │       ├── middleware/   # Auth, error handler, helmet
│   │       ├── routes/       # auth, accounts, categories, transactions,
│   │       │                 #   subscriptions, investments, loans, dashboard
│   │       ├── services/     # Lógica de negócio
│   │       ├── app.ts        # Express app setup
│   │       └── server.ts     # HTTP server entrypoint
│   └── bot/                 # Telegram bot (Telegraf) — reaproveita @moneyapp/db
│       └── src/
│           ├── config.ts     # env validado com zod
│           ├── auth.ts       # middleware: checa se ctx.from.id tem vínculo com email/senha no banco
│           ├── context.ts    # Tipagem estendida do Telegraf
│           ├── ui/           # Telas do bot, cenas (wizards) e ícones globais
│           ├── handlers/     # Controladores de ações principais (/start, etc)
│           ├── cron/         # Trabalhos agendados (notificações)
│           ├── utils/        # Funções utilitárias e geração de gráficos
│           └── index.ts      # bootstrap: middleware, scenes, rotas
├── packages/
│   ├── api-client/          # Cliente HTTP e tipagens de rotas
│   ├── db/                  # Drizzle ORM schemas e automação de migrations
│   ├── models/              # Zod validation schemas (auth, transactions, etc)
│   └── services/            # Serviços backend compartilhados (configs, hash)
└── AI_context/              # This directory
```

## Tech choices and why

| Layer        | Choice                         | Reason                                                                                                                                  |
| ------------ | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Validation   | **Zod in `packages/models`**   | Single source of truth for both client and server.                                                                                      |
| ORM          | **Drizzle**                    | SQL-first; works well with raw aggregations.                                                                                            |
| Auth         | **JWT (bearer)**               | Stateless, fits a single-user-per-deploy PWA.                                                                                           |
| Hashing      | **argon2**                     | Memory-hard; preferred over bcrypt for new builds.                                                                                      |
| File uploads | **Inline base64 / TEXT**       | User's explicit choice — no S3, no disk footprint.                                                                                      |
| PWA shell    | **VitePWA (`selfDestroying`)** | Service worker disabled — it pinned clients to stale builds; the app needs live data. nginx serves `sw.js`/`index.html` as `no-store`.  |
| Charts       | **ApexCharts**                 | Donut + line charts with smooth transitions.                                                                                            |
| Icons        | **Lucide**                     | Consistent, tree-shakeable icon set.                                                                                                    |
| Logging      | **Pino + pino-http**           | Fast JSON-structured logging.                                                                                                           |
| Security     | **Helmet**                     | Secure HTTP headers out of the box.                                                                                                     |

## Deployment

The monorepo ships as **three** containers via `docker-compose.yml`:

- `moneyapp_backend` (Node 20)
- `moneyapp_frontend` (nginx serving Vite build output)
- `moneyapp_bot` (Node 20, Telegraf — long polling, no exposed port)

No Postgres container is defined — we attach to `awl_network` which already
hosts `awlsrvDB_postgres`.

Production ingress goes through a **Cloudflare Tunnel** container on
`awl_network` directly to `moneyapp_frontend:80`. No host ports are exposed.

## Cron & Background Jobs

The Telegram bot (`moneyapp_bot`) also acts as the background worker for the system.

- It uses `node-cron` to schedule background jobs.
- It handles daily notifications for "Próximos Lançamentos" (upcoming transactions).
- It uses `nodemailer` to dispatch email alerts to the user alongside Telegram messages.
