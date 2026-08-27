DO $$ BEGIN
 CREATE TYPE "public"."account_type" AS ENUM('checking', 'savings', 'credit_card', 'wallet', 'investment', 'other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."category_type" AS ENUM('expense', 'income');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."investment_type" AS ENUM('stock', 'crypto', 'fixed_income', 'fund', 'other');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."loan_status" AS ENUM('active', 'paid');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."loan_type" AS ENUM('given', 'received', 'fgts');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."subscription_status" AS ENUM('active', 'inactive');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."transaction_status" AS ENUM('paid', 'pending');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."transaction_type" AS ENUM('expense', 'income');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loginhub_id" integer NOT NULL,
	"name" varchar(120) NOT NULL,
	"type" "account_type" NOT NULL,
	"bank_code" varchar(32),
	"custom_icon_url" text,
	"current_balance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"freeze_balance" boolean DEFAULT false NOT NULL,
	"credit_limit" numeric(14, 2),
	"closing_day" numeric,
	"due_day" numeric,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loginhub_id" integer NOT NULL,
	"name" varchar(120) NOT NULL,
	"type" "category_type" NOT NULL,
	"color" varchar(9),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "investments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loginhub_id" integer NOT NULL,
	"account_id" uuid,
	"name" varchar(120) NOT NULL,
	"type" "investment_type" NOT NULL,
	"quantity" numeric(14, 6) NOT NULL,
	"buy_price" numeric(14, 2) NOT NULL,
	"current_price" numeric(14, 2) DEFAULT '0' NOT NULL,
	"buy_date" timestamp with time zone NOT NULL,
	"goal_amount" numeric(14, 2),
	"yield_rate" numeric(14, 2),
	"yield_index" varchar(32),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "loans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loginhub_id" integer NOT NULL,
	"account_id" uuid,
	"category_id" uuid,
	"description" varchar(255) NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"expected_amount" numeric(14, 2),
	"date" timestamp with time zone NOT NULL,
	"type" "loan_type" NOT NULL,
	"status" "loan_status" DEFAULT 'active' NOT NULL,
	"receipt_base64" text,
	"receipt_mime_type" varchar(255),
	"payment_receipt_base64" text,
	"payment_receipt_mime_type" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE IF NOT EXISTS "shared_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loginhub_id" integer NOT NULL,
	"category_id" uuid,
	"token" varchar(128) NOT NULL,
	"password_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shared_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loginhub_id" integer NOT NULL,
	"description" varchar(255) NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"type" "transaction_type" NOT NULL,
	"category_id" uuid NOT NULL,
	"account_id" uuid,
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"billing_day" numeric,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "telegram_link_tokens" (
	"token_hash" varchar(64) PRIMARY KEY NOT NULL,
	"loginhub_id" integer NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"usado_em" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loginhub_id" integer NOT NULL,
	"description" varchar(255) NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"type" "transaction_type" NOT NULL,
	"status" "transaction_status" DEFAULT 'paid' NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"category_id" uuid NOT NULL,
	"account_id" uuid,
	"subscription_id" uuid,
	"investment_id" uuid,
	"loan_id" uuid,
	"invoice_card_id" uuid,
	"receipt_base64" text,
	"receipt_mime_type" varchar(80),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_settings" (
	"loginhub_id" integer PRIMARY KEY NOT NULL,
	"telegram_id" varchar(50),
	"settings" jsonb DEFAULT '{"requireReceipts":true}'::jsonb NOT NULL,
	CONSTRAINT "user_settings_telegram_id_unique" UNIQUE("telegram_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "investments" ADD CONSTRAINT "investments_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "loans" ADD CONSTRAINT "loans_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "loans" ADD CONSTRAINT "loans_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "shared_links" ADD CONSTRAINT "shared_links_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_investment_id_investments_id_fk" FOREIGN KEY ("investment_id") REFERENCES "public"."investments"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_invoice_card_id_accounts_id_fk" FOREIGN KEY ("invoice_card_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounts_loginhub_idx" ON "accounts" USING btree ("loginhub_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "categories_loginhub_idx" ON "categories" USING btree ("loginhub_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "categories_loginhub_name_type_uq" ON "categories" USING btree ("loginhub_id","name","type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "investments_loginhub_idx" ON "investments" USING btree ("loginhub_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "investments_account_idx" ON "investments" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "loans_loginhub_idx" ON "loans" USING btree ("loginhub_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "push_subscriptions_loginhub_idx" ON "push_subscriptions" USING btree ("loginhub_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shared_links_loginhub_idx" ON "shared_links" USING btree ("loginhub_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "shared_links_token_idx" ON "shared_links" USING btree ("token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriptions_loginhub_idx" ON "subscriptions" USING btree ("loginhub_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "telegram_link_tokens_expira_idx" ON "telegram_link_tokens" USING btree ("expira_em");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_loginhub_occurred_idx" ON "transactions" USING btree ("loginhub_id","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_user_type_occurred_idx" ON "transactions" USING btree ("loginhub_id","type","occurred_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_category_idx" ON "transactions" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_account_idx" ON "transactions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_subscription_idx" ON "transactions" USING btree ("subscription_id");