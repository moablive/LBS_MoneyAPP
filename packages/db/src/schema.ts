import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  numeric,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  pgEnum,
  pgTable,
  jsonb,
  integer,
} from "drizzle-orm/pg-core";

export const transactionTypeEnum = pgEnum("transaction_type", [
  "expense",
  "income",
]);
export const transactionStatusEnum = pgEnum("transaction_status", [
  "paid",
  "pending",
]);
export const categoryTypeEnum = pgEnum("category_type", ["expense", "income"]);
export const accountTypeEnum = pgEnum("account_type", [
  "checking",
  "savings",
  "credit_card",
  "wallet",
  "investment",
  "other",
]);
export const investmentTypeEnum = pgEnum("investment_type", [
  "stock",
  "crypto",
  "fixed_income",
  "fund",
  "other",
]);

// -------- userSettings --------------------------------------------------------------
export const userSettings = pgTable("user_settings", {
  loginhubId: integer("loginhub_id").primaryKey(),
  telegramId: varchar("telegram_id", { length: 50 }).unique(),
  settings: jsonb("settings").default({ requireReceipts: true }).notNull(),
});

// -------- categories ---------------------------------------------------------
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    loginhubId: integer("loginhub_id").notNull(),
        name: varchar("name", { length: 120 }).notNull(),
    type: categoryTypeEnum("type").notNull(),
    color: varchar("color", { length: 9 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    userIdx: index("categories_loginhub_idx").on(t.loginhubId),
    uniqueUserNameType: uniqueIndex("categories_loginhub_name_type_uq").on(
      t.loginhubId,
      t.name,
      t.type,
    ),
  }),
);

// -------- accounts -----------------------------------------------------------
export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    loginhubId: integer("loginhub_id").notNull(),
        name: varchar("name", { length: 120 }).notNull(),
    type: accountTypeEnum("type").notNull(),
    // Identifier into the static bank registry on the frontend
    // (e.g. "itau", "nubank", "picpay"). Nullable for cash/wallet/other.
    bankCode: varchar("bank_code", { length: 32 }),
    // Optional user-provided icon (base64 data URL or external URL) when the
    // bank is not in the registry yet.
    customIconUrl: text("custom_icon_url"),
    currentBalance: numeric("current_balance", { precision: 14, scale: 2 })
      .default("0")
      .notNull(),
    // When true the account is "frozen": paid transactions/loans linked to it
    // never mutate `currentBalance`. Used for closed/cancelled accounts whose
    // balance is kept only as historical reference (e.g. cancelled Mercado Pago).
    freezeBalance: boolean("freeze_balance").default(false).notNull(),
    creditLimit: numeric("credit_limit", { precision: 14, scale: 2 }),
    closingDay: numeric("closing_day"), // 1-31
    dueDay: numeric("due_day"), // 1-31
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({ userIdx: index("accounts_loginhub_idx").on(t.loginhubId) }),
);

// -------- subscriptions ------------------------------------------------------
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "inactive",
]);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    loginhubId: integer("loginhub_id").notNull(),
        description: varchar("description", { length: 255 }).notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    type: transactionTypeEnum("type").notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    accountId: uuid("account_id").references(() => accounts.id, {
      onDelete: "set null",
    }),
    status: subscriptionStatusEnum("status").default("active").notNull(),
    billingDay: numeric("billing_day"), // 1-31
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    userIdx: index("subscriptions_loginhub_idx").on(t.loginhubId),
  }),
);

// -------- transactions -------------------------------------------------------
export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    loginhubId: integer("loginhub_id").notNull(),
        description: varchar("description", { length: 255 }).notNull(),
    // Signed: negative = expense, positive = income. `type` is denormalized
    // for fast filtering and to keep the UI's filter chips O(1).
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    type: transactionTypeEnum("type").notNull(),
    status: transactionStatusEnum("status").default("paid").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    accountId: uuid("account_id").references(() => accounts.id, {
      onDelete: "set null",
    }),
    subscriptionId: uuid("subscription_id").references(() => subscriptions.id, {
      onDelete: "set null",
    }),
    investmentId: uuid("investment_id").references(() => investments.id, {
      onDelete: "set null",
    }),
    loanId: uuid("loan_id").references(() => loans.id, {
      onDelete: "set null",
    }),
    receiptBase64: text("receipt_base64"),
    receiptMimeType: varchar("receipt_mime_type", { length: 80 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    userOccurredIdx: index("transactions_loginhub_occurred_idx").on(
      t.loginhubId,
      t.occurredAt,
    ),
    userTypeOccurredIdx: index("transactions_user_type_occurred_idx").on(
      t.loginhubId,
      t.type,
      t.occurredAt,
    ),
    categoryIdx: index("transactions_category_idx").on(t.categoryId),
    accountIdx: index("transactions_account_idx").on(t.accountId),
    subscriptionIdx: index("transactions_subscription_idx").on(
      t.subscriptionId,
    ),
  }),
);

// -------- loans --------------------------------------------------------------
export const loanStatusEnum = pgEnum("loan_status", ["active", "paid"]);
export const loanTypeEnum = pgEnum("loan_type", ["given", "received", "fgts"]);

export const loans = pgTable(
  "loans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    loginhubId: integer("loginhub_id").notNull(),
        accountId: uuid("account_id").references(() => accounts.id, {
      onDelete: "set null",
    }),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    description: varchar("description", { length: 255 }).notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    expectedAmount: numeric("expected_amount", { precision: 14, scale: 2 }),
    date: timestamp("date", { withTimezone: true }).notNull(),
    type: loanTypeEnum("type").notNull(),
    status: loanStatusEnum("status").default("active").notNull(),
    receiptBase64: text("receipt_base64"),
    receiptMimeType: varchar("receipt_mime_type", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    userIdx: index("loans_loginhub_idx").on(t.loginhubId),
  }),
);

// -------- shared links -----------------------------------------------------
export const sharedLinks = pgTable(
  "shared_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    loginhubId: integer("loginhub_id").notNull(),
        categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    token: varchar("token", { length: 128 }).notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    userIdx: index("shared_links_loginhub_idx").on(t.loginhubId),
    tokenIdx: uniqueIndex("shared_links_token_idx").on(t.token),
  }),
);

// -------- relations ----------------------------------------------------------

// -------- investments --------------------------------------------------------
export const investments = pgTable(
  "investments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    loginhubId: integer("loginhub_id").notNull(),
    accountId: uuid("account_id").references(() => accounts.id, {
      onDelete: "set null",
    }),
    name: varchar("name", { length: 120 }).notNull(),
    type: investmentTypeEnum("type").notNull(),
    quantity: numeric("quantity", { precision: 14, scale: 6 }).notNull(),
    buyPrice: numeric("buy_price", { precision: 14, scale: 2 }).notNull(),
    currentPrice: numeric("current_price", { precision: 14, scale: 2 })
      .default("0")
      .notNull(),
    buyDate: timestamp("buy_date", { withTimezone: true }).notNull(),
    goalAmount: numeric("goal_amount", { precision: 14, scale: 2 }),
    yieldRate: numeric("yield_rate", { precision: 14, scale: 2 }),
    yieldIndex: varchar("yield_index", { length: 32 }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    userIdx: index("investments_loginhub_idx").on(t.loginhubId),
    accountIdx: index("investments_account_idx").on(t.accountId),
  }),
);
export const userSettingsRelations = relations(userSettings, ({ many }) => ({
  categories: many(categories),
  accounts: many(accounts),
  transactions: many(transactions),
  subscriptions: many(subscriptions),
  investments: many(investments),
  loans: many(loans),
  sharedLinks: many(sharedLinks),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  transactions: many(transactions),
  subscriptions: many(subscriptions),
  loans: many(loans),
  sharedLinks: many(sharedLinks),
}));

export const accountsRelations = relations(accounts, ({ many }) => ({
  transactions: many(transactions),
  subscriptions: many(subscriptions),
  investments: many(investments),
  loans: many(loans),
}));

export const subscriptionsRelations = relations(
  subscriptions,
  ({ one, many }) => ({
    category: one(categories, {
      fields: [subscriptions.categoryId],
      references: [categories.id],
    }),
    account: one(accounts, {
      fields: [subscriptions.accountId],
      references: [accounts.id],
    }),
    transactions: many(transactions),
  }),
);

export const transactionsRelations = relations(transactions, ({ one }) => ({
  category: one(categories, {
    fields: [transactions.categoryId],
    references: [categories.id],
  }),
  account: one(accounts, {
    fields: [transactions.accountId],
    references: [accounts.id],
  }),
  subscription: one(subscriptions, {
    fields: [transactions.subscriptionId],
    references: [subscriptions.id],
  }),
  investment: one(investments, {
    fields: [transactions.investmentId],
    references: [investments.id],
  }),
  loan: one(loans, { fields: [transactions.loanId], references: [loans.id] }),
}));

export const investmentsRelations = relations(investments, ({ one, many }) => ({
  account: one(accounts, {
    fields: [investments.accountId],
    references: [accounts.id],
  }),
  transactions: many(transactions),
}));

export const loansRelations = relations(loans, ({ one }) => ({
  account: one(accounts, {
    fields: [loans.accountId],
    references: [accounts.id],
  }),
  category: one(categories, {
    fields: [loans.categoryId],
    references: [categories.id],
  }),
}));

export const sharedLinksRelations = relations(sharedLinks, ({ one }) => ({
  category: one(categories, {
    fields: [sharedLinks.categoryId],
    references: [categories.id],
  }),
}));

export type UserSettingsType = typeof userSettings.$inferSelect;
export type NewUserSettings = typeof userSettings.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type Investment = typeof investments.$inferSelect;
export type NewInvestment = typeof investments.$inferInsert;
export type Loan = typeof loans.$inferSelect;
export type NewLoan = typeof loans.$inferInsert;
export type SharedLink = typeof sharedLinks.$inferSelect;
export type NewSharedLink = typeof sharedLinks.$inferInsert;
