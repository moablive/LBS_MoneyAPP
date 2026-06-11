# Business rules

These are **invariants**. Any code change that breaks one of these is wrong,
regardless of how clean it looks.

## Transactions

1. **Signed amount.** `expense` transactions store `amount < 0`. `income`
   transactions store `amount > 0`. Zero is never valid.
2. **`type` is denormalized** from the sign for fast filtering, but must
   always match the sign. Both the Zod schema (`createTransactionSchema`)
   and any update path must enforce this.
3. **Receipts** are optional and stored inline as base64.
4. **Subscriptions** are standalone entities, detached from being just flags in transactions. Transactions created from a subscription hold a `subscription_id` to trace back to their origin. Subscriptions have `status` (active/inactive) and a `billing_day`.

## Categories

5. Categories are **per-user** and **typed** (`expense` vs `income`).
   A category called `Aluguel` of type `income` is a different entity
   from `Aluguel` of type `expense`. The unique index enforces this.
6. **Names support emoji and ad-hoc tagging.** UI shows literal strings
   like `! - MyMonth 💬`. Do not auto-strip or "normalize" these.

## Accounts

7. `currentBalance` is **denormalized** and updated on transaction insert /
   update / delete inside the same transaction (DB transaction). Never
   write to `currentBalance` outside of that path.
8. Accounts are optional on a transaction (a `Multa Detran RS` may have no
   linked account). The schema reflects this with a nullable FK and
   `onDelete: set null`.
8b. **Frozen accounts (`freeze_balance = true`).** A frozen/historical account
   (e.g. a closed Mercado Pago) keeps its `current_balance` as a read-only
   reference. The `applyBalanceDelta` helper (in `loans.ts` and
   `transactions.ts`) adds `freeze_balance = false` to its `WHERE`, so balance
   mutations silently skip frozen accounts. The dashboard "Saldo Atual" total
   also excludes them. For credit cards, they are **always** excluded from the "Saldo Atual", but their `freeze_balance = false` toggle determines if they are included in the separate "Cartões" invoice total on the dashboard. The UI switch is phrased as "Afeta o saldo total" (or "Afeta a soma de Cartões") — checked
   means `freeze_balance = false`.

## Receipts

9. Receipts are stored **inline** in `transactions.receipt_base64` and `loans.receipt_base64` (TEXT)
   plus `receipt_mime_type`. Max 5 MB decoded.
10. Allowed mime types: `image/png`, `image/jpeg`, `image/webp`,
    `application/pdf`. Anything else is a 400.
11. The client may send a `data:` URL — the Zod schema strips the prefix
    before validating.

## Auth

12. Every endpoint except `/health` and `/api/auth/login` requires a valid JWT.
13. `userId` is taken **only** from `req.user.id` — never from the body
    or query string, even for "admin" tools. There is no admin role yet.
14. **Master user bootstrap and invites.** On every backend startup, if
    `MASTER_USER_EMAIL` or `MASTER_USER_N_EMAIL` (1, 2, 3...) are set, the users are upsert-ed against the DB
    with an argon2 hash of their passwords and flagged with `default_password = true`.
    The plaintext value must never leave env memory. To rotate the master password, change
    the env var, set the DB flag to true manually, and restart the container; the next boot re-hashes.
14b. **Default Password Block.** A user with `default_password = true` MUST change their password upon their first web UI login. Using the Telegram bot is blocked until the password is changed.

## Investments

15. **Investments** are distinct entities associated with `accounts`. They store a `buy_price`, `current_price`, and `quantity`.
16. The logic supports setting goals (`goal_amount`) and tracking yields (`yield_rate`, `yield_index`).
17. Transactions can be linked to an investment via `investment_id` to keep track of buying/selling events that map to actual cash flows.

## Loans

18. **Loans** represent money given, received, or FGTS. They are distinct entities that can optionally link to an `accountId`.
19. They have a `type` (`given`, `received`, `fgts`) and `status` (`active`, `paid`).
20. Like transactions, loans support inline receipts in base64.
20a. **Marking a loan `paid` requires a `category_id` AND a receipt** (enforced
    client-side in `LoanModal`). On save the backend mirrors the loan into a
    `transaction` in that category, linked via `transactions.loan_id`, applying
    the signed amount (`received` → expense, otherwise income) and the account
    balance delta — all inside one DB transaction. Editing back to `active` (or
    clearing the category) deletes the mirror transaction and reverts the
    balance.
20b. **Paid loans leave the Empréstimos shortcut list.** The `LoansView` filter
    hides a loan only when it is `paid` **and** has a `category_id` (i.e. it has
    a mirror transaction and now lives in the Livro Caixa). A paid loan without
    a category stays visible so it never vanishes from every screen.

## Aggregations

21. All dashboard aggregations include all transactions within the selected period.
21a. The dashboard **"Saldo Atual"** (sum of `accounts.current_balance`) excludes
    frozen accounts (`freeze_balance = true`) AND completely excludes credit cards (`type = 'credit_card'`). Credit cards debts are summed separately into a **"Cartões"** KPI, and only if they are not frozen (`freeze_balance = false`). Income/expense aggregations are
    transaction-based and are not affected by this flag.
22. Month-over-month comparisons use **calendar months in UTC**, anchored
    on day 1 at 00:00:00Z. We never use rolling 30-day windows.
23. **Monthly projections** take the current month's expenses and combine them with recurring future expenses (from active Subscriptions) to predict end-of-month balances and spendings.

## Telegram bot (`apps/bot`)

24. **The bot is a second writer of transactions**, inserting directly via
    `@moneyapp/db` (no HTTP, it bypasses the backend). It must uphold the
    transaction invariants by hand: signed amount (#1), `type` matching the
    sign (#2), and `numeric(14,2)` written as a 2-decimal string. See
    `addTransaction` in `apps/bot/src/db/transactions.ts`. It also supports
    attaching base64 inline receipts to existing transactions via the `attachReceipt` flow.
25. **Bot transactions carry no account and are always `paid`.**
    `addTransaction` sets `status = 'paid'`, `occurred_at = now()` and leaves
    `account_id` null — so they never mutate any `current_balance` (consistent
    with #7/#8) and surface only in income/expense aggregations, not in
    per-account balances.
26. **Multi-tenant via Telegram Login.** Any user who has a valid email and password in the MoneyAPP database can use the bot by sending `/login <email> <password>`. The bot links their `telegram_id` to their DB user, and subsequent actions are automatically routed to their specific profile. The user MUST have `default_password = false` to login.
27. **Background Notifications (Cron).** The bot executes a daily check at 08:00 AM. It fetches all users with a registered `telegram_id` and checks for "Próximos Lançamentos" that are due in exactly 7 days. If matches are found, it sends a Telegram alert, and also an email if the user has a registered email and SMTP is configured.
