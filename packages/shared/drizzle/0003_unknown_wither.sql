ALTER TABLE "investments" ADD COLUMN "goal_amount" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "investments" ADD COLUMN "yield_rate" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "investments" ADD COLUMN "yield_index" varchar(32);--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "investment_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_investment_id_investments_id_fk" FOREIGN KEY ("investment_id") REFERENCES "public"."investments"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
