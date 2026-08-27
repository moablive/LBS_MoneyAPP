ALTER TABLE "loans" ADD COLUMN "payment_receipt_base64" text;--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN "payment_receipt_mime_type" varchar(255);