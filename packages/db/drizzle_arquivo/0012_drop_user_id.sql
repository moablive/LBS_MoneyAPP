ALTER TABLE "accounts" DROP COLUMN IF EXISTS "user_id";
ALTER TABLE "categories" DROP COLUMN IF EXISTS "user_id";
ALTER TABLE "investments" DROP COLUMN IF EXISTS "user_id";
ALTER TABLE "loans" DROP COLUMN IF EXISTS "user_id";
ALTER TABLE "shared_links" DROP COLUMN IF EXISTS "user_id";
ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "user_id";
ALTER TABLE "transactions" DROP COLUMN IF EXISTS "user_id";

DELETE FROM "user_settings" WHERE "loginhub_id" IS NULL;

ALTER TABLE "user_settings" DROP CONSTRAINT IF EXISTS "user_settings_pkey" CASCADE;
ALTER TABLE "user_settings" DROP COLUMN IF EXISTS "id";
ALTER TABLE "user_settings" ADD PRIMARY KEY ("loginhub_id");

ALTER TABLE "accounts" ALTER COLUMN "loginhub_id" SET NOT NULL;
ALTER TABLE "categories" ALTER COLUMN "loginhub_id" SET NOT NULL;
ALTER TABLE "investments" ALTER COLUMN "loginhub_id" SET NOT NULL;
ALTER TABLE "loans" ALTER COLUMN "loginhub_id" SET NOT NULL;
ALTER TABLE "shared_links" ALTER COLUMN "loginhub_id" SET NOT NULL;
ALTER TABLE "subscriptions" ALTER COLUMN "loginhub_id" SET NOT NULL;
ALTER TABLE "transactions" ALTER COLUMN "loginhub_id" SET NOT NULL;
ALTER TABLE "user_settings" ALTER COLUMN "loginhub_id" SET NOT NULL;
