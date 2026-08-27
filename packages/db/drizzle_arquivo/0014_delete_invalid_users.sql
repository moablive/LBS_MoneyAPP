DELETE FROM "transactions" WHERE "loginhub_id" NOT IN (12, 10, 6);
DELETE FROM "shared_links" WHERE "loginhub_id" NOT IN (12, 10, 6);
DELETE FROM "loans" WHERE "loginhub_id" NOT IN (12, 10, 6);
DELETE FROM "subscriptions" WHERE "loginhub_id" NOT IN (12, 10, 6);
DELETE FROM "investments" WHERE "loginhub_id" NOT IN (12, 10, 6);
DELETE FROM "accounts" WHERE "loginhub_id" NOT IN (12, 10, 6);
DELETE FROM "categories" WHERE "loginhub_id" NOT IN (12, 10, 6);
DELETE FROM "user_settings" WHERE "loginhub_id" NOT IN (12, 10, 6);
