DELETE FROM "transactions" WHERE "loginhub_id" IS NULL;
DELETE FROM "loans" WHERE "loginhub_id" IS NULL;
DELETE FROM "categories" WHERE "loginhub_id" IS NULL;

ALTER TABLE "categories" ALTER COLUMN "loginhub_id" SET NOT NULL;
ALTER TABLE "loans" ALTER COLUMN "loginhub_id" SET NOT NULL;
ALTER TABLE "transactions" ALTER COLUMN "loginhub_id" SET NOT NULL;
