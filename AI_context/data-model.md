# Data model

Canonical source: `packages/shared/src/db/schema.ts`. This document explains the
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
  subscriptions ||--o{ transactions: generates
  investments ||--o{ transactions: generates

  users {
    uuid id PK
    varchar name
    varchar email UK
    text password_hash
    timestamptz created_at
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
    numeric current_balance
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
    bool is_recurring
    bool is_investment
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
