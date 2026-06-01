DO $$ BEGIN
 CREATE TYPE "public"."transaction_status" AS ENUM('paid', 'pending');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "status" "transaction_status" DEFAULT 'paid' NOT NULL;