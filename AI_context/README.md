# AI_context

Strategic, hand-curated context for AI agents (Claude Code, Cursor, Gemini, etc.) to
read **before** doing non-trivial work on MoneyAPP. Everything in here is the
"why" and "how to think about it" that cannot be inferred from the code alone.

## How to use

1. Start with `project-map.json` — a structured index of where things live.
2. Read `architecture.md` for the system shape (topology, workspaces, tech choices).
3. Read `business-rules.md` for the invariants. Violating these = wrong output.
4. Consult `data-model.md`, `api-contracts.md` and `ui-guidelines.md` when
   touching their respective surface area.

## Documents at a glance

| File                  | Content                                               |
| --------------------- | ----------------------------------------------------- |
| `project-map.json`    | Structured index: infra, packages, entities, routes, invariants |
| `architecture.md`     | Topology diagram, workspace tree, tech choices, deployment |
| `business-rules.md`   | 20+ numbered invariants (transactions, subscriptions, investments, loans, auth, aggregations) |
| `data-model.md`       | ER diagram (7 entities), indexes, column conventions   |
| `api-contracts.md`    | 30+ endpoints (auth, CRUD, loans, dashboard), Zod schemas, conventions |
| `ui-guidelines.md`    | Visual tokens, typography, motion, modals, charts, dashboard patterns |

## What goes here vs. inline docs

| Belongs in `AI_context/`                          | Belongs next to code                          |
| ------------------------------------------------- | --------------------------------------------- |
| Cross-cutting business rules                      | Function-level JSDoc                          |
| Architectural decisions and trade-offs            | Adjacent README for a single package          |
| UX style system & motion principles               | Tailwind config (the actual tokens)           |
| Diagrams (mermaid) of flows                       | Tests (the actual contracts)                  |

Keep entries short. Long-form belongs in the codebase or PR descriptions.

## Current modules covered

- **Transactions** — CRUD, signed amounts, receipts, filters
- **Categories** — per-user, typed (expense/income), emoji support
- **Accounts** — bank registry, denormalized balance
- **Subscriptions** — standalone entities, status, billing_day
- **Investments** — stocks, crypto, fixed income, funds, goals, yields
- **Loans (Empréstimos)** — tracking for money given, received and FGTS
- **Dashboard** — summary, ranking, spending evolution, monthly projection
