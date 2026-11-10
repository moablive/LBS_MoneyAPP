-- Clientes da venda do MoneyAPP (10/11/2026): quem preencheu o formulário de
-- assinatura da página /assine — nome, e-mail, WhatsApp e CPF ou CNPJ — antes de
-- ir para o Mercado Pago. O LoginHUB cuida da assinatura e do pagamento; aqui
-- fica o cadastro do cliente. Idempotente: pode rodar de novo sem efeito.
-- Escrita à mão, como a 0001 e a 0002 (meta/ só tem o snapshot 0000).
CREATE TABLE IF NOT EXISTS "clientes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"telefone" varchar(20),
	"documento" varchar(14) NOT NULL,
	"tipo_documento" varchar(4) NOT NULL,
	"afiliado" varchar(40),
	"pedido" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "clientes_email_uq" ON "clientes" USING btree ("email");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clientes_documento_idx" ON "clientes" USING btree ("documento");
