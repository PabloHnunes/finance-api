/*
  Warnings:

  - You are about to drop the column `monthly_fees` on the `financing_details` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "fee_type_enum" AS ENUM ('FIXED', 'ON_BALANCE', 'ON_INSTALLMENT', 'ON_TOTAL_AMOUNT');

-- AlterTable
ALTER TABLE "financing_details" DROP COLUMN "monthly_fees";

-- CreateTable
CREATE TABLE "financing_fees" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "type" "fee_type_enum" NOT NULL,
    "value" DECIMAL(10,6) NOT NULL,
    "financing_detail_id" TEXT NOT NULL,

    CONSTRAINT "financing_fees_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "financing_fees" ADD CONSTRAINT "financing_fees_financing_detail_id_fkey" FOREIGN KEY ("financing_detail_id") REFERENCES "financing_details"("id") ON DELETE CASCADE ON UPDATE CASCADE;
