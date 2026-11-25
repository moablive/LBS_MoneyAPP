-- Registro por voz (25/11/2026, pedido do dono): contas ditas ao bot do Telegram caem
-- nesta caixa, sem categoria obrigatória e sem mexer no saldo. Só viram lançamento
-- (transactions) quando o dono confirma pelo app. Idempotente: pode rodar de novo sem efeito.
-- Escrita à mão, como a 0001 a 0003 (meta/ só tem o snapshot 0000).
CREATE TABLE IF NOT EXISTS "voice_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loginhub_id" integer NOT NULL,
	"transcription" text NOT NULL,
	"description" varchar(255) NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"type" "transaction_type" NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"suggested_category_id" uuid REFERENCES "categories"("id") ON DELETE SET NULL,
	"suggested_account_id" uuid REFERENCES "accounts"("id") ON DELETE SET NULL,
	"category_id" uuid REFERENCES "categories"("id") ON DELETE SET NULL,
	"account_id" uuid REFERENCES "accounts"("id") ON DELETE SET NULL,
	"empresa_id" uuid REFERENCES "empresas"("id") ON DELETE SET NULL,
	"status" varchar(12) DEFAULT 'pending' NOT NULL,
	"transaction_id" uuid REFERENCES "transactions"("id") ON DELETE SET NULL,
	"source" varchar(20) DEFAULT 'telegram' NOT NULL,
	"external_key" varchar(80),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "voice_entries_external_uq" ON "voice_entries" USING btree ("loginhub_id","external_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "voice_entries_user_status_idx" ON "voice_entries" USING btree ("loginhub_id","status","occurred_at");
