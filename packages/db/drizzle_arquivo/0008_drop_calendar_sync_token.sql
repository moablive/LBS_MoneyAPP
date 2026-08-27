ALTER TABLE "transactions" DROP COLUMN IF EXISTS "google_event_id";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "google_refresh_token";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "google_calendar_id";