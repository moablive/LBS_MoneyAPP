ALTER TABLE "loans" ADD COLUMN "receipt_base64" text;--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN "receipt_mime_type" varchar(255);