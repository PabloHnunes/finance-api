-- CreateTable
CREATE TABLE "recurring_expense_histories" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "recurring_expense_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recurring_expense_histories_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "recurring_expense_histories" ADD CONSTRAINT "recurring_expense_histories_recurring_expense_id_fkey" FOREIGN KEY ("recurring_expense_id") REFERENCES "recurring_expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
