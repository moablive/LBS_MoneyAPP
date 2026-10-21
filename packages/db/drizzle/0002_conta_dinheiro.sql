-- Tipo de conta "cash" (dinheiro em espécie): pagamento por ela não exige
-- comprovante. Idempotente: pode rodar de novo sem efeito.
-- Escrita à mão, como a 0001 (meta/ só tem o snapshot 0000): antes de usar o
-- drizzle-kit generate, gere os snapshots 0001/0002, senão ele regera as duas.
-- ADD VALUE dentro da transação do migrate exige PostgreSQL 12+.
ALTER TYPE "public"."account_type" ADD VALUE IF NOT EXISTS 'cash';
