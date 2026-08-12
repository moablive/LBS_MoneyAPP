CREATE TABLE IF NOT EXISTS "push_subscriptions" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"loginhub_id" integer NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "invoice_card_id" uuid;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "push_subscriptions_loginhub_idx" ON "push_subscriptions" USING btree ("loginhub_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_invoice_card_id_accounts_id_fk" FOREIGN KEY ("invoice_card_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
