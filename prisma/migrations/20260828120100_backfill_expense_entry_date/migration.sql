-- Backfill: "created_at" guardava até aqui a data de lançamento do gasto, não a
-- data de criação do registro. Copiamos esse valor histórico para "entry_date"
-- antes de "created_at" voltar a representar a data real de criação.
UPDATE "expense_entries" SET "entry_date" = "created_at" WHERE "entry_date" IS NULL;

-- AlterTable
ALTER TABLE "expense_entries" ALTER COLUMN "entry_date" SET NOT NULL,
ALTER COLUMN "entry_date" SET DEFAULT now();
