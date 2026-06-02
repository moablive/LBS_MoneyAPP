import { relations } from 'drizzle-orm';
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
} from 'drizzle-orm/pg-core';

export const transactionTypeEnum = pgEnum('transaction_type', ['expense', 'income']);
export const transactionStatusEnum = pgEnum('transaction_status', ['paid', 'pending']);
export const categoryTypeEnum = pgEnum('category_type', ['expense', 'income']);
export const accountTypeEnum = pgEnum('account_type', [
  'checking',
  'savings',
  'credit_card',
  'wallet',
  'investment',
  'other',
]);
export const investmentTypeEnum = pgEnum('investment_type', [
  'stock',
  'crypto',
  'fixed_income',
  'fund',
  'other',
]);

// -------- users --------------------------------------------------------------
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 120 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  settings: jsonb('settings').default({ requireReceipts: true }).notNull(),
});

// -------- categories ---------------------------------------------------------
export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 120 }).notNull(),
    type: categoryTypeEnum('type').notNull(),
    color: varchar('color', { length: 9 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('categories_user_idx').on(t.userId),
    uniqueUserNameType: uniqueIndex('categories_user_name_type_uq').on(t.userId, t.name, t.type),
  }),
);

// -------- accounts -----------------------------------------------------------
export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 120 }).notNull(),
    type: accountTypeEnum('type').notNull(),
    // Identifier into the static bank registry on the frontend
    // (e.g. "itau", "nubank", "picpay"). Nullable for cash/wallet/other.
    bankCode: varchar('bank_code', { length: 32 }),
    // Optional user-provided icon (base64 data URL or external URL) when the
    // bank is not in the registry yet.
    customIconUrl: text('custom_icon_url'),
    currentBalance: numeric('current_balance', { precision: 14, scale: 2 }).default('0').notNull(),
    // When true the account is "frozen": paid transactions/loans linked to it
    // never mutate `currentBalance`. Used for closed/cancelled accounts whose
    // balance is kept only as historical reference (e.g. cancelled Mercado Pago).
    freezeBalance: boolean('freeze_balance').default(false).notNull(),
    creditLimit: numeric('credit_limit', { precision: 14, scale: 2 }),
    closingDay: numeric('closing_day'), // 1-31
    dueDay: numeric('due_day'), // 1-31
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ userIdx: index('accounts_user_idx').on(t.userId) }),
);

// -------- subscriptions ------------------------------------------------------
export const subscriptionStatusEnum = pgEnum('subscription_status', ['active', 'inactive']);

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    description: varchar('description', { length: 255 }).notNull(),
    amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
    type: transactionTypeEnum('type').notNull(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    accountId: uuid('account_id').references(() => accounts.id, { onDelete: 'set null' }),
    status: subscriptionStatusEnum('status').default('active').notNull(),
    billingDay: numeric('billing_day'), // 1-31
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('subscriptions_user_idx').on(t.userId),
  }),
);

// -------- transactions -------------------------------------------------------
export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    description: varchar('description', { length: 255 }).notNull(),
    // Signed: negative = expense, positive = income. `type` is denormalized
    // for fast filtering and to keep the UI's filter chips O(1).
    amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
    type: transactionTypeEnum('type').notNull(),
    status: transactionStatusEnum('status').default('paid').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    accountId: uuid('account_id').references(() => accounts.id, { onDelete: 'set null' }),
    subscriptionId: uuid('subscription_id').references(() => subscriptions.id, { onDelete: 'set null' }),
    investmentId: uuid('investment_id').references(() => investments.id, { onDelete: 'set null' }),
    loanId: uuid('loan_id').references(() => loans.id, { onDelete: 'set null' }),
    receiptBase64: text('receipt_base64'),
    receiptMimeType: varchar('receipt_mime_type', { length: 80 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userOccurredIdx: index('transactions_user_occurred_idx').on(t.userId, t.occurredAt),
    userTypeOccurredIdx: index('transactions_user_type_occurred_idx').on(
      t.userId,
      t.type,
      t.occurredAt,
    ),
    categoryIdx: index('transactions_category_idx').on(t.categoryId),
    accountIdx: index('transactions_account_idx').on(t.accountId),
    subscriptionIdx: index('transactions_subscription_idx').on(t.subscriptionId),
  }),
);

// -------- loans --------------------------------------------------------------
export const loanStatusEnum = pgEnum('loan_status', ['active', 'paid']);
export const loanTypeEnum = pgEnum('loan_type', ['given', 'received', 'fgts']);

export const loans = pgTable(
  'loans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: uuid('account_id').references(() => accounts.id, { onDelete: 'set null' }),
    categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
    description: varchar('description', { length: 255 }).notNull(),
    amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
    date: timestamp('date', { withTimezone: true }).notNull(),
    type: loanTypeEnum('type').notNull(),
    status: loanStatusEnum('status').default('active').notNull(),
    receiptBase64: text('receipt_base64'),
    receiptMimeType: varchar('receipt_mime_type', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('loans_user_idx').on(t.userId),
  }),
);

// -------- relations ----------------------------------------------------------

// -------- investments --------------------------------------------------------
export const investments = pgTable(
  'investments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: uuid('account_id').references(() => accounts.id, { onDelete: 'set null' }),
    name: varchar('name', { length: 120 }).notNull(),
    type: investmentTypeEnum('type').notNull(),
    quantity: numeric('quantity', { precision: 14, scale: 6 }).notNull(),
    buyPrice: numeric('buy_price', { precision: 14, scale: 2 }).notNull(),
    currentPrice: numeric('current_price', { precision: 14, scale: 2 }).default('0').notNull(),
    buyDate: timestamp('buy_date', { withTimezone: true }).notNull(),
    goalAmount: numeric('goal_amount', { precision: 14, scale: 2 }),
    yieldRate: numeric('yield_rate', { precision: 14, scale: 2 }),
    yieldIndex: varchar('yield_index', { length: 32 }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('investments_user_idx').on(t.userId),
    accountIdx: index('investments_account_idx').on(t.accountId),
  }),
);
export const usersRelations = relations(users, ({ many }) => ({
  categories: many(categories),
  accounts: many(accounts),
  transactions: many(transactions),
  subscriptions: many(subscriptions),
  investments: many(investments),
  loans: many(loans),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  user: one(users, { fields: [categories.userId], references: [users.id] }),
  transactions: many(transactions),
  subscriptions: many(subscriptions),
  loans: many(loans),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
  transactions: many(transactions),
  subscriptions: many(subscriptions),
  investments: many(investments),
  loans: many(loans),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  user: one(users, { fields: [subscriptions.userId], references: [users.id] }),
  category: one(categories, { fields: [subscriptions.categoryId], references: [categories.id] }),
  account: one(accounts, { fields: [subscriptions.accountId], references: [accounts.id] }),
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, { fields: [transactions.userId], references: [users.id] }),
  category: one(categories, { fields: [transactions.categoryId], references: [categories.id] }),
  account: one(accounts, { fields: [transactions.accountId], references: [accounts.id] }),
  subscription: one(subscriptions, { fields: [transactions.subscriptionId], references: [subscriptions.id] }),
  investment: one(investments, { fields: [transactions.investmentId], references: [investments.id] }),
  loan: one(loans, { fields: [transactions.loanId], references: [loans.id] }),
}));

export const investmentsRelations = relations(investments, ({ one, many }) => ({
  user: one(users, { fields: [investments.userId], references: [users.id] }),
  account: one(accounts, { fields: [investments.accountId], references: [accounts.id] }),
  transactions: many(transactions),
}));

export const loansRelations = relations(loans, ({ one }) => ({
  user: one(users, { fields: [loans.userId], references: [users.id] }),
  account: one(accounts, { fields: [loans.accountId], references: [accounts.id] }),
  category: one(categories, { fields: [loans.categoryId], references: [categories.id] }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
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
