import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BalanceService {
  constructor(private readonly prisma: PrismaService) {}

  async getBalance(userId: string, month: number, year: number) {
    const [salaries, expenses, recurringExpenses] = await Promise.all([
      this.getSalaries(userId, month, year),
      this.getExpenses(userId, month, year),
      this.getRecurringNotGenerated(userId, month, year),
    ]);

    const totalSalary = salaries.reduce((sum, s) => sum + Number(s.amount), 0);

    const expensesByCategory: Record<string, number> = {};
    const expensesByPaymentType: Record<string, number> = {};
    let totalExpenses = 0;

    for (const expense of expenses) {
      const effectiveAmount =
        Number(expense.amount) * (expense.userPart / expense.splitParts);

      totalExpenses += effectiveAmount;

      if (expense.expenseCategory) {
        expensesByCategory[expense.expenseCategory] =
          (expensesByCategory[expense.expenseCategory] ?? 0) + effectiveAmount;
      }
      if (expense.paymentType) {
        expensesByPaymentType[expense.paymentType] =
          (expensesByPaymentType[expense.paymentType] ?? 0) + effectiveAmount;
      }
    }

    for (const recurring of recurringExpenses) {
      const effectiveAmount =
        Number(recurring.amount) * (recurring.userPart / recurring.splitParts);

      totalExpenses += effectiveAmount;

      if (recurring.expenseCategory) {
        expensesByCategory[recurring.expenseCategory] =
          (expensesByCategory[recurring.expenseCategory] ?? 0) +
          effectiveAmount;
      }
      if (recurring.paymentType) {
        expensesByPaymentType[recurring.paymentType] =
          (expensesByPaymentType[recurring.paymentType] ?? 0) + effectiveAmount;
      }
    }

    return {
      period: { month, year },
      totalSalary,
      totalExpenses,
      balance: totalSalary - totalExpenses,
      expensesByCategory,
      expensesByPaymentType,
    };
  }

  private async getSalaries(userId: string, month: number, year: number) {
    const salaries = await this.prisma.salary.findMany({
      where: { userId, isActive: true, deletedAt: null },
      include: {
        history: {
          orderBy: [{ year: 'desc' as const }, { month: 'desc' as const }],
        },
      },
    });

    return salaries
      .map(
        (salary: {
          name: string;
          isMain: boolean;
          history: Array<{ year: number; month: number; amount: unknown }>;
        }) => {
          const entry = salary.isMain
            ? salary.history.find(
                (h) => h.year < year || (h.year === year && h.month <= month),
              )
            : salary.history.find(
                (h) => h.year === year && h.month === month,
              );
          return entry
            ? { name: salary.name, isMain: salary.isMain, amount: entry.amount }
            : null;
        },
      )
      .filter((s) => s !== null);
  }

  private async getRecurringNotGenerated(
    userId: string,
    month: number,
    year: number,
  ) {
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 1);

    // 2 queries em vez de N+1
    const [recurringExpenses, generatedEntries] = await Promise.all([
      this.prisma.recurringExpense.findMany({
        where: {
          userId,
          isActive: true,
          startDate: { lte: periodEnd },
        },
      }),
      this.prisma.expenseEntry.findMany({
        where: {
          createdById: userId,
          deletedAt: null,
          recurringExpenseId: { not: null },
          createdAt: { gte: periodStart, lt: periodEnd },
        },
        select: { recurringExpenseId: true },
      }),
    ]);

    const generatedIds = new Set(
      generatedEntries.map((e) => e.recurringExpenseId),
    );

    return recurringExpenses.filter((r) => !generatedIds.has(r.id));
  }

  private getExpenses(userId: string, month: number, year: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    return this.prisma.expenseEntry.findMany({
      where: {
        createdById: userId,
        deletedAt: null,
        settledAt: null,
        createdAt: {
          gte: startDate,
          lt: endDate,
        },
      },
    });
  }
}
