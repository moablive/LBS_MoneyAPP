DROP INDEX IF EXISTS "accounts_user_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "categories_user_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "categories_user_name_type_uq";--> statement-breakpoint
DROP INDEX IF EXISTS "investments_user_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "loans_user_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "shared_links_user_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "subscriptions_user_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "transactions_user_occurred_idx";--> statement-breakpoint
DROP INDEX IF EXISTS "transactions_user_type_occurred_idx";--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "loginhub_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "accounts" ALTER COLUMN "loginhub_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "categories" ALTER COLUMN "loginhub_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "categories" ALTER COLUMN "loginhub_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "investments" ALTER COLUMN "loginhub_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "investments" ALTER COLUMN "loginhub_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "loans" ALTER COLUMN "loginhub_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "loans" ALTER COLUMN "loginhub_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "shared_links" ALTER COLUMN "loginhub_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "shared_links" ALTER COLUMN "loginhub_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "loginhub_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "subscriptions" ALTER COLUMN "loginhub_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "loginhub_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "loginhub_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "user_settings" ADD PRIMARY KEY ("loginhub_id");--> statement-breakpoint
ALTER TABLE "user_settings" ALTER COLUMN "loginhub_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "user_settings" ALTER COLUMN "loginhub_id" SET NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounts_loginhub_idx" ON "accounts" USING btree ("loginhub_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "categories_loginhub_idx" ON "categories" USING btree ("loginhub_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "categories_loginhub_name_type_uq" ON "categories" USING btree ("loginhub_id","name","type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "investments_loginhub_idx" ON "investments" USING btree ("loginhub_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loans_loginhub_idx" ON "loans" USING btree ("loginhub_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shared_links_loginhub_idx" ON "shared_links" USING btree ("loginhub_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriptions_loginhub_idx" ON "subscriptions" USING btree ("loginhub_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_loginhub_occurred_idx" ON "transactions" USING btree ("loginhub_id","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_user_type_occurred_idx" ON "transactions" USING btree ("loginhub_id","type","occurred_at");--> statement-breakpoint
ALTER TABLE "accounts" DROP COLUMN IF EXISTS "user_id";--> statement-breakpoint
ALTER TABLE "categories" DROP COLUMN IF EXISTS "user_id";--> statement-breakpoint
ALTER TABLE "investments" DROP COLUMN IF EXISTS "user_id";--> statement-breakpoint
ALTER TABLE "loans" DROP COLUMN IF EXISTS "user_id";--> statement-breakpoint
ALTER TABLE "shared_links" DROP COLUMN IF EXISTS "user_id";--> statement-breakpoint
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "user_id";--> statement-breakpoint
ALTER TABLE "transactions" DROP COLUMN IF EXISTS "user_id";--> statement-breakpoint
ALTER TABLE "user_settings" DROP COLUMN IF EXISTS "id";