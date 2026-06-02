# Architecture

## Topology

```mermaid
flowchart LR
  subgraph Client
    PWA[Vue 3 PWA<br/>Vite + Pinia + Tailwind]
  end

  subgraph awl_network[Docker network: awl_network]
    NGINX[(nginx<br/>moneyapp_frontend:80)]
    API[(Express + Drizzle<br/>moneyapp_backend:3000)]
    PG[(awlsrvDB_postgres:5432<br/>database "moneyapp")]
  end

  PWA -- HTTPS --> NGINX
  NGINX -- /api/ --> API
  API -- pg --> PG
```

- The PWA is served as static assets by `nginx` inside `moneyapp_frontend`.
- `nginx` reverse-proxies `/api/` to `moneyapp_backend` via internal DNS.
- The backend connects to the **existing shared Postgres** container
  `awlsrvDB_postgres` via the external Docker network `awl_network`.
- MoneyAPP uses its own dedicated Postgres **database** named `moneyapp`
  (tables in the `public` schema) on the shared `awlsrvDB_postgres` instance,
  so they don't collide with other apps.

## Workspaces

```
moneyapp/
├── apps/
│   ├── frontend/            # Vue 3 PWA (Vite, Pinia, Tailwind, VitePWA)
│   │   └── src/
│   │       ├── api/          # HTTP fetch wrappers
│   │       ├── components/   # AppShell, EmptyState, Modal, modais de CRUD
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
│   └── backend/             # Express + TypeScript + Drizzle + JWT
│       └── src/
│           ├── bootstrap/    # Inicialização (master user upsert)
│           ├── config/       # Variáveis de ambiente tipadas
│           ├── middleware/   # Auth, error handler, helmet
│           ├── routes/       # auth, accounts, categories, transactions,
│           │                 #   subscriptions, investments, loans, dashboard
│           ├── services/     # Lógica de negócio
│           ├── app.ts        # Express app setup
│           └── server.ts     # HTTP server entrypoint
├── packages/
│   ├── api-client/          # Cliente HTTP e tipagens de rotas
│   ├── db/                  # Drizzle ORM schemas e automação de migrations
│   ├── models/              # Zod validation schemas (auth, transactions, etc)
│   └── services/            # Serviços backend compartilhados (configs, hash)
└── AI_context/              # This directory
```

## Tech choices and why

| Layer        | Choice                  | Reason                                              |
| ------------ | ----------------------- | --------------------------------------------------- |
| Validation   | **Zod in `packages/models`** | Single source of truth for both client and server. |
| ORM          | **Drizzle**             | SQL-first; works well with raw aggregations.        |
| Auth         | **JWT (bearer)**        | Stateless, fits a single-user-per-deploy PWA.       |
| Hashing      | **argon2**              | Memory-hard; preferred over bcrypt for new builds.  |
| File uploads | **Inline base64 / TEXT**| User's explicit choice — no S3, no disk footprint.  |
| PWA shell    | **VitePWA (`selfDestroying`)** | Service worker disabled — it pinned clients to stale builds; the app needs live data. nginx serves `sw.js`/`index.html` as `no-store`, hashed `/assets/*` as `immutable`. |
| Charts       | **ApexCharts**          | Donut + line charts with smooth transitions.        |
| Icons        | **Lucide**              | Consistent, tree-shakeable icon set.                |
| Logging      | **Pino + pino-http**    | Fast JSON-structured logging.                       |
| Security     | **Helmet**              | Secure HTTP headers out of the box.                 |

## Deployment

The monorepo ships as exactly **two** containers via `docker-compose.yml`:

- `moneyapp_backend` (Node 20)
- `moneyapp_frontend` (nginx serving Vite build output)

No Postgres container is defined — we attach to `awl_network` which already
hosts `awlsrvDB_postgres`.

Production ingress goes through a **Cloudflare Tunnel** container on
`awl_network` directly to `moneyapp_frontend:80`. No host ports are exposed.
