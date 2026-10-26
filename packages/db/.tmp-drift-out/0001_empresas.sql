-- Empresas (Moab Corp, Astral Wave, Conselho Ômega…) e a empresa de cada conta
-- e lançamento. Idempotente: pode rodar de novo sem efeito.
CREATE TABLE IF NOT EXISTS "empresas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loginhub_id" integer NOT NULL,
	"nome" varchar(120) NOT NULL,
	"cnpj" varchar(18),
	"cor" varchar(9),
	"parent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "empresas_loginhub_idx" ON "empresas" USING btree ("loginhub_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "empresas_loginhub_nome_uq" ON "empresas" USING btree ("loginhub_id","nome");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "empresas" ADD CONSTRAINT "empresas_parent_id_empresas_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."empresas"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "empresa_id" uuid;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "empresa_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "accounts" ADD CONSTRAINT "accounts_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transactions" ADD CONSTRAINT "transactions_empresa_id_empresas_id_fk" FOREIGN KEY ("empresa_id") REFERENCES "public"."empresas"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounts_empresa_idx" ON "accounts" USING btree ("empresa_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transactions_empresa_idx" ON "transactions" USING btree ("empresa_id");
