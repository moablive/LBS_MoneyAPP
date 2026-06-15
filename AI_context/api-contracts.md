# API contracts

All endpoints are under `/api`. Request and response bodies match the Zod
schemas exported from `@moneyapp/models`. Wherever a Zod schema exists, it
is the contract — this document is a map, not a duplicate.

> The Telegram bot (`apps/bot`) does **not** use this API — it reads and writes
> the database directly via `@moneyapp/db`. These contracts cover the web app only.

## Conventions

- **Auth:** `Authorization: Bearer <jwt>`.
- **Errors:** `{ "error": "<code>", "issues"?: ZodFlatten }`. HTTP status
  carries the category (400, 401, 403, 404, 409, 422, 500).
- **Pagination:** cursor-based via `?cursor=<opaque>`; limit max 200.
- **Dates:** ISO 8601 with timezone. Server parses with `z.coerce.date()`.
- **Currency:** sent as a JSON number (negative = expense). Stored as
  `numeric(14,2)`.

## Endpoints

### Auth
| Method | Path                  | Body schema           | Notes                  |
| ------ | --------------------- | --------------------- | ---------------------- |
| POST   | `/api/auth/login`     | `loginSchema`         | returns `{ token }`    |

### Users
| Method | Path                       | Body                       | Notes                                            |
| ------ | -------------------------- | -------------------------- | ------------------------------------------------ |
| PATCH  | `/api/users/me/settings`   | `{ requireReceipts: bool }`| Merge nas `users.settings`; retorna o objeto novo (auth) |
| POST   | `/api/users/me/password`   | `{ newPassword: string }` | Atualiza a senha e marca `defaultPassword` como false |

### Categories
| Method | Path                       | Schema                 |
| ------ | -------------------------- | ---------------------- |
| GET    | `/api/categories`          | query: `?type=`        |
| POST   | `/api/categories`          | `createCategorySchema` |
| PATCH  | `/api/categories/:id`      | `updateCategorySchema` |
| DELETE | `/api/categories/:id`      | —                      |

### Accounts
| Method | Path                       | Schema                 |
| ------ | -------------------------- | ---------------------- |
| GET    | `/api/accounts`            | —                      |
| POST   | `/api/accounts`            | `createAccountSchema`  |
| PATCH  | `/api/accounts/:id`        | `updateAccountSchema`  |
| DELETE | `/api/accounts/:id`        | —                      |
| POST   | `/api/accounts/:id/pay-invoice` | `payInvoiceSchema` |

> `createAccountSchema` / `updateAccountSchema` include `freezeBalance: boolean`
> (default `false`). `true` = historical account: balance frozen and excluded
> from the dashboard total.

### Transactions
| Method | Path                          | Schema                          |
| ------ | ----------------------------- | ------------------------------- |
| GET    | `/api/transactions`           | query: `transactionFiltersSchema` |
| POST   | `/api/transactions`           | `createTransactionSchema`       |
| PATCH  | `/api/transactions/:id`       | `updateTransactionSchema`       |
| DELETE | `/api/transactions/:id`       | —                               |
| GET    | `/api/transactions/:id/receipt` | streams decoded base64        |

### Shares (Public Access)
| Method | Path                                          | Schema                          |
| ------ | --------------------------------------------- | ------------------------------- |
| POST   | `/api/shares`                                 | `{ categoryId?: string }`       |
| POST   | `/api/shares/:token/verify`                   | `{ password: string }`          |
| GET    | `/api/shares/:token/transactions`             | `Bearer <sessionToken>`         |
| GET    | `/api/shares/:token/transactions/:id/receipt` | `Bearer <sessionToken>`, stream |

### Subscriptions
| Method | Path                          | Schema                          |
| ------ | ----------------------------- | ------------------------------- |
| GET    | `/api/subscriptions`          | —                               |
| POST   | `/api/subscriptions`          | `createSubscriptionSchema`      |
| PATCH  | `/api/subscriptions/:id`      | `updateSubscriptionSchema`      |
| DELETE | `/api/subscriptions/:id`      | —                               |

### Investments
| Method | Path                          | Schema                          |
| ------ | ----------------------------- | ------------------------------- |
| GET    | `/api/investments`            | —                               |
| POST   | `/api/investments`            | `createInvestmentSchema`        |
| PATCH  | `/api/investments/:id`        | `updateInvestmentSchema`        |
| DELETE | `/api/investments/:id`        | —                               |

### Loans
| Method | Path                          | Schema                          |
| ------ | ----------------------------- | ------------------------------- |
| GET    | `/api/loans/summary`          | returns `LoanSummaryResponse` (items carry `categoryId`, `hasReceipt`) |
| POST   | `/api/loans`                  | `createLoanSchema` (supports `installments`, `categoryId`, `receipt`) |
| PUT    | `/api/loans/:id`              | `updateLoanSchema` — marking `paid` mirrors a transaction in the category |
| DELETE | `/api/loans/:id`              | —                               |
| GET    | `/api/loans/:id/receipt`      | streams decoded base64          |

### Dashboard
| Method | Path                                       | Schema                                    |
| ------ | ------------------------------------------ | ----------------------------------------- |
| GET    | `/api/dashboard/summary`                   | query: `?month=YYYY-MM`                   |
| GET    | `/api/dashboard/categories/ranking`        | query: `categoryRankingQuerySchema`       |
| GET    | `/api/dashboard/spending-evolution`        | cumulative line series (current vs prev)  |
| GET    | `/api/dashboard/projection`                | projections based on recurrent spendings  |

### Bot (Internal)
| Method | Path                                       | Schema                                    | Notes                                            |
| ------ | ------------------------------------------ | ----------------------------------------- | ------------------------------------------------ |
| POST   | `/api/bot/login`                           | `{ email, password, telegramId }`         | Validates credentials and links telegram_id. Verifies `default_password == false` |
| GET    | `/api/bot/users/all`                       | —                                         | Returns all users with non-null `telegramId` for notification dispatch |

## The ranking endpoint (reference implementation)

See `apps/backend/src/routes/dashboard.ts`. It returns
`CategoryRankingResponse` — current month total per category, previous
month total, share of current, and signed variation %. Aggregation is
done in a single SQL round trip using `case when ... then ... end`
inside `sum(...)`.
