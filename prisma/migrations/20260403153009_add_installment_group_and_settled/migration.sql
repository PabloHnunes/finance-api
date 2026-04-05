-- AlterTable
ALTER TABLE "expense_entries" ADD COLUMN     "installment_group_id" TEXT,
ADD COLUMN     "settled_at" TIMESTAMP(3);
