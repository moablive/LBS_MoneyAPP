ALTER TABLE "transactions" ADD COLUMN "google_event_id" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "google_refresh_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "google_calendar_id" varchar(255);