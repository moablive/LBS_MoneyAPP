ALTER TABLE "accounts" DROP COLUMN IF EXISTS "loginhub_id";
ALTER TABLE "accounts" ADD COLUMN "loginhub_id" integer;

ALTER TABLE "categories" DROP COLUMN IF EXISTS "loginhub_id";
ALTER TABLE "categories" ADD COLUMN "loginhub_id" integer;

ALTER TABLE "investments" DROP COLUMN IF EXISTS "loginhub_id";
ALTER TABLE "investments" ADD COLUMN "loginhub_id" integer;

ALTER TABLE "loans" DROP COLUMN IF EXISTS "loginhub_id";
ALTER TABLE "loans" ADD COLUMN "loginhub_id" integer;

ALTER TABLE "shared_links" DROP COLUMN IF EXISTS "loginhub_id";
ALTER TABLE "shared_links" ADD COLUMN "loginhub_id" integer;

ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "loginhub_id";
ALTER TABLE "subscriptions" ADD COLUMN "loginhub_id" integer;

ALTER TABLE "transactions" DROP COLUMN IF EXISTS "loginhub_id";
ALTER TABLE "transactions" ADD COLUMN "loginhub_id" integer;

ALTER TABLE "user_settings" DROP COLUMN IF EXISTS "loginhub_id";
ALTER TABLE "user_settings" ADD COLUMN "loginhub_id" integer;

UPDATE "accounts" SET "loginhub_id" = 6 WHERE "user_id" = '6';
UPDATE "categories" SET "loginhub_id" = 6 WHERE "user_id" = '6';
UPDATE "investments" SET "loginhub_id" = 6 WHERE "user_id" = '6';
UPDATE "loans" SET "loginhub_id" = 6 WHERE "user_id" = '6';
UPDATE "shared_links" SET "loginhub_id" = 6 WHERE "user_id" = '6';
UPDATE "subscriptions" SET "loginhub_id" = 6 WHERE "user_id" = '6';
UPDATE "transactions" SET "loginhub_id" = 6 WHERE "user_id" = '6';
UPDATE "user_settings" SET "loginhub_id" = 6 WHERE "id" = '6';
