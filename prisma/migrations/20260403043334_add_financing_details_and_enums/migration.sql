/*
  Warnings:

  - The values [FINANCING] on the enum `expense_category_enum` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "financing_type_enum" AS ENUM ('PERSONAL_LOAN', 'VEHICLE', 'PROPERTY');

-- CreateEnum
CREATE TYPE "amortization_type_enum" AS ENUM ('SAC', 'PRICE');

-- AlterEnum
BEGIN;
CREATE TYPE "expense_category_enum_new" AS ENUM ('LEISURE', 'LOAN', 'FINANCING_PROPERTY', 'FINANCING_VEHICLE', 'GROCERIES', 'TRANSPORTATION', 'UTILITIES', 'HEALTHCARE', 'EDUCATION');
ALTER TABLE "expense_entries" ALTER COLUMN "expense_category" TYPE "expense_category_enum_new" USING ("expense_category"::text::"expense_category_enum_new");
ALTER TYPE "expense_category_enum" RENAME TO "expense_category_enum_old";
ALTER TYPE "expense_category_enum_new" RENAME TO "expense_category_enum";
DROP TYPE "public"."expense_category_enum_old";
COMMIT;

-- CreateTable
CREATE TABLE "financing_details" (
    "id" TEXT NOT NULL,
    "financing_type" "financing_type_enum" NOT NULL,
    "amortization_type" "amortization_type_enum" NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "interest_rate" DECIMAL(6,4) NOT NULL,
    "total_installments" INTEGER NOT NULL,
    "paid_installments" INTEGER NOT NULL DEFAULT 0,
    "start_month" INTEGER NOT NULL,
    "start_year" INTEGER NOT NULL,
    "expense_entry_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financing_details_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "financing_details_expense_entry_id_key" ON "financing_details"("expense_entry_id");

-- AddForeignKey
ALTER TABLE "financing_details" ADD CONSTRAINT "financing_details_expense_entry_id_fkey" FOREIGN KEY ("expense_entry_id") REFERENCES "expense_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
