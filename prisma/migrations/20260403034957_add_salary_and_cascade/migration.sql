-- DropForeignKey
ALTER TABLE "auth_providers" DROP CONSTRAINT "auth_providers_user_id_fkey";

-- DropForeignKey
ALTER TABLE "banks" DROP CONSTRAINT "banks_user_id_fkey";

-- DropForeignKey
ALTER TABLE "expense_entries" DROP CONSTRAINT "expense_entries_created_by_fkey";

-- CreateTable
CREATE TABLE "salaries" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "is_main" BOOLEAN NOT NULL DEFAULT false,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_histories" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "salary_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salary_histories_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "auth_providers" ADD CONSTRAINT "auth_providers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banks" ADD CONSTRAINT "banks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_entries" ADD CONSTRAINT "expense_entries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salaries" ADD CONSTRAINT "salaries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_histories" ADD CONSTRAINT "salary_histories_salary_id_fkey" FOREIGN KEY ("salary_id") REFERENCES "salaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
