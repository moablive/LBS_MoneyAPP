import re

with open('packages/db/src/schema.ts', 'r') as f:
    content = f.read()

# 1. Replace users table definition
old_users = """export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 120 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  // Identity (password) lives in LoginHub. This table only mirrors the profile
  // and owns all MoneyAPP financial data via FKs. `telegramId` is MoneyAPP-local
  // linkage written by the bot after LoginHub validates the user.
  telegramId: varchar('telegram_id', { length: 50 }).unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  settings: jsonb('settings').default({ requireReceipts: true }).notNull(),
});"""

new_settings = """export const userSettings = pgTable('user_settings', {
  id: varchar('id', { length: 50 }).primaryKey(),
  telegramId: varchar('telegram_id', { length: 50 }).unique(),
  settings: jsonb('settings').default({ requireReceipts: true }).notNull(),
});"""

content = content.replace(old_users, new_settings)

# 2. Replace userId definitions
content = re.sub(r"userId:\s*uuid\('user_id'\)\s*\.notNull\(\)\s*\.references\(\(\)\s*=>\s*users\.id,\s*\{[^}]*\}\s*\)", "userId: varchar('user_id', { length: 50 }).notNull()", content)
content = re.sub(r"userId:\s*uuid\('user_id'\)\s*\.notNull\(\)\s*\.references\(\(\)\s*=>\s*users\.id\)", "userId: varchar('user_id', { length: 50 }).notNull()", content)

# There are multi-line references
content = re.sub(r"userId:\s*uuid\('user_id'\)\s*\n\s*\.notNull\(\)\s*\n\s*\.references\(\(\)\s*=>\s*users\.id,\s*\{[^}]*\}\s*\)", "userId: varchar('user_id', { length: 50 }).notNull()", content)

# 3. Replace relations definitions
# Users relations -> UserSettings relations
content = content.replace("export const usersRelations = relations(users, ({ many }) => ({", "export const userSettingsRelations = relations(userSettings, ({ many }) => ({")

# Replace reference to `users` in relations
content = re.sub(r"user:\s*one\(users,\s*\{\s*fields:\s*\[[^\.]*\.userId\],\s*references:\s*\[users\.id\]\s*\}\),", "", content)
content = content.replace("users", "userSettings")

# 4. Replace Types
content = content.replace("export type User = typeof userSettings.$inferSelect;", "export type UserSettingsType = typeof userSettings.$inferSelect;")
content = content.replace("export type NewUser = typeof userSettings.$inferInsert;", "export type NewUserSettings = typeof userSettings.$inferInsert;")

with open('packages/db/src/schema.ts', 'w') as f:
    f.write(content)
