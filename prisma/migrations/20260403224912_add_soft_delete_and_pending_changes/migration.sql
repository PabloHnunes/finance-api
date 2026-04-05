-- AlterTable
ALTER TABLE "banks" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "salaries" ADD COLUMN     "deleted_at" TIMESTAMP(3);
