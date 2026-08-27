ALTER TABLE "accounts" ADD COLUMN "loginhub_id" uuid;
ALTER TABLE "categories" ADD COLUMN "loginhub_id" uuid;
ALTER TABLE "investments" ADD COLUMN "loginhub_id" uuid;
ALTER TABLE "loans" ADD COLUMN "loginhub_id" uuid;
ALTER TABLE "shared_links" ADD COLUMN "loginhub_id" uuid;
ALTER TABLE "subscriptions" ADD COLUMN "loginhub_id" uuid;
ALTER TABLE "transactions" ADD COLUMN "loginhub_id" uuid;
ALTER TABLE "user_settings" ADD COLUMN "loginhub_id" uuid;
