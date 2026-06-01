ALTER TABLE "accounts" ADD COLUMN "credit_limit" numeric(14, 2);--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "closing_day" numeric;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "due_day" numeric;