# Data model

Canonical source: `packages/db/src/schema.ts`. This document explains the
**shape and intent**; the schema file is the source of truth for column types.

## ER diagram

```mermaid
erDiagram
  users ||--o{ categories   : owns
  users ||--o{ accounts     : owns
  users ||--o{ transactions : owns
  users ||--o{ subscriptions: owns
  users ||--o{ investments  : owns
  users ||--o{ loans        : owns
  categories ||--o{ transactions : classifies
  categories ||--o{ subscriptions: classifies
  accounts ||--o{ transactions : funds
  accounts ||--o{ subscriptions: funds
  accounts ||--o{ investments  : custodies
  accounts ||--o{ loans        : custodies
  categories ||--o{ loans      : classifies
  subscriptions ||--o{ transactions: generates
  investments ||--o{ transactions: generates
  loans ||--o{ transactions    : generates

  users {
    uuid id PK
    varchar name
    varchar email UK
    text password_hash
    boolean default_password
    jsonb settings "{ requireReceipts: bool }"
    timestamptz created_at
    timestamptz updated_at
  }

  categories {
    uuid id PK
    uuid user_id FK
    varchar name
    enum type "expense | income"
    varchar color
  }

  accounts {
    uuid id PK
    uuid user_id FK
    varchar name
    enum type "checking | savings | credit_card | wallet | investment | other"
    varchar bank_code "id no registry de bancos (itau, nubank...); null p/ wallet/other"
    text custom_icon_url "ícone custom quando o banco não está no registry"
    numeric current_balance
    bool freeze_balance "historical/closed account — excluded from totals & not mutated"
    numeric credit_limit "cartão de crédito"
    numeric closing_day "cartão: fechamento (1-31)"
    numeric due_day "cartão: vencimento (1-31)"
  }

  transactions {
    uuid id PK
    uuid user_id FK
    varchar description
    numeric amount "signed"
    enum type "expense | income"
    timestamptz occurred_at
    uuid category_id FK
    uuid account_id FK "nullable"
    uuid subscription_id FK "nullable"
    uuid investment_id FK "nullable"
    uuid loan_id FK "nullable"
    enum status "paid | pending"
    text receipt_base64 "nullable"
    varchar receipt_mime_type "nullable"
  }

  subscriptions {
    uuid id PK
    uuid user_id FK
    varchar description
    numeric amount "signed"
    enum type "expense | income"
    uuid category_id FK
    uuid account_id FK "nullable"
    enum status "active | inactive"
    numeric billing_day "nullable"
  }

  investments {
    uuid id PK
    uuid user_id FK
    uuid account_id FK "nullable"
    varchar name
    enum type "stock | crypto | fixed_income | fund | other"
    numeric quantity
    numeric buy_price
    numeric current_price
    timestamptz buy_date
    numeric goal_amount "nullable"
    numeric yield_rate "nullable"
    varchar yield_index "nullable"
    text notes "nullable"
  }

  loans {
    uuid id PK
    uuid user_id FK
    uuid account_id FK "nullable"
    uuid category_id FK "nullable — set when marked paid"
    varchar description
    numeric amount
    timestamptz date
    enum type "given | received | fgts"
    enum status "active | paid"
    text receipt_base64 "nullable"
    varchar receipt_mime_type "nullable"
  }
```

## Indexes (what they're for)

| Index                                     | Query it accelerates                          |
| ----------------------------------------- | --------------------------------------------- |
| `transactions_user_occurred_idx`          | "list my transactions in this period"         |
| `transactions_user_type_occurred_idx`     | filter chips ("only despesas this month")     |
| `transactions_category_idx`               | dashboard ranking aggregation                 |
| `transactions_account_idx`                | per-account statements                        |
| `transactions_subscription_idx`           | find transactions for a given subscription    |
| `categories_user_name_type_uq`            | prevent dup categories per user per type      |
| `subscriptions_user_idx`                  | list subscriptions for a user                 |
| `investments_user_idx`                    | list investments for a user                   |
| `investments_account_idx`                 | list investments linked to an account         |
| `loans_user_idx`                          | list loans for a user                         |

## Conventions

- All primary keys: `uuid` with `defaultRandom()`.
- All money fields: `numeric(14,2)`. Never `double`. Drizzle returns these
  as strings — coerce with `Number()` only when computing aggregates;
  store and return them as strings/decimals to the client.
- All timestamps: `timestamptz` (`with timezone`). Server logic uses UTC.
- Soft delete is **not used**. Hard deletes with FK cascades / restrict
  where appropriate.

## Notable columns

- **`accounts.freeze_balance`** (bool, default `false`). A *frozen* account
  (historical / closed, e.g. a cancelled Mercado Pago) keeps its
  `current_balance` as a read-only reference: paid transactions/loans never
  mutate it, and it is **excluded** from the dashboard total balance. The UI
  presents the inverse — a switch labelled "Afeta o saldo": checked = affects
  (`freeze_balance = false`), unchecked = historical (`freeze_balance = true`).
- **`loans.category_id`** + **`transactions.loan_id`**. When a loan is marked
  `paid` (which requires a category and a receipt), the backend creates a mirror
  `transaction` in that category linked back via `transactions.loan_id`, so the
  paid loan shows up in the Livro Caixa under its category. Both FKs are
  `onDelete: set null`.
