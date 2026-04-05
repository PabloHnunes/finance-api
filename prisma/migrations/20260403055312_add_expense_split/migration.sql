/*
  Warnings:

  - Added the required column `start_date` to the `recurring_expenses` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "financing_type_enum" ADD VALUE 'OTHER';

-- AlterTable
ALTER TABLE "expense_entries" ADD COLUMN     "split_parts" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "user_part" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "financing_details" ADD COLUMN     "description" VARCHAR(150);

-- AlterTable
ALTER TABLE "recurring_expenses" ADD COLUMN     "split_parts" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "start_date" DATE NOT NULL,
ADD COLUMN     "user_part" INTEGER NOT NULL DEFAULT 1;
