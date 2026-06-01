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
    PG[(awlsrvDB_postgres:5432<br/>schema "moneyapp")]
  end

  PWA -- HTTPS --> NGINX
  NGINX -- /api/ --> API
  API -- pg --> PG
```

- The PWA is served as static assets by `nginx` inside `moneyapp_frontend`.
- `nginx` reverse-proxies `/api/` to `moneyapp_backend` via internal DNS.
- The backend connects to the **existing shared Postgres** container
  `awlsrvDB_postgres` via the external Docker network `awl_network`.
- All MoneyAPP tables live in a dedicated Postgres schema named `moneyapp`
  so they don't collide with other apps on the same database.

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
│   └── shared/              # Zod schemas, Drizzle schema, inferred TS types
│       └── src/
│           ├── db/           # schema.ts (Drizzle db schemas) + migrations
│           └── schema/       # auth, account, category, common, dashboard,
│                             #   subscription, transaction, investment, loan
└── AI_context/              # This directory
```

## Tech choices and why

| Layer        | Choice                  | Reason                                              |
| ------------ | ----------------------- | --------------------------------------------------- |
| Validation   | **Zod in `shared`**     | Single source of truth for both client and server.  |
| ORM          | **Drizzle**             | SQL-first; works well with raw aggregations.        |
| Auth         | **JWT (bearer)**        | Stateless, fits a single-user-per-deploy PWA.       |
| Hashing      | **argon2**              | Memory-hard; preferred over bcrypt for new builds.  |
| File uploads | **Inline base64 / TEXT**| User's explicit choice — no S3, no disk footprint.  |
| PWA shell    | **VitePWA + Workbox**   | NetworkFirst for `/api`, precache for static.       |
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
