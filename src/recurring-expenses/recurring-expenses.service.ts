import { Injectable, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { ExpenseCategory, PaymentType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginatedResponse } from '../common/dto/paginated-response.dto';
import { parseAsUTCDate, createUTCDate } from '../common/utils/date.utils';
import { CreateRecurringExpenseDto } from './dto/create-recurring-expense.dto';
import { UpdateRecurringExpenseDto } from './dto/update-recurring-expense.dto';

@Injectable()
export class RecurringExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateRecurringExpenseDto) {
    const { startDate, ...rest } = dto;
    const start = parseAsUTCDate(startDate);
    const startMonth = start.getUTCMonth() + 1;
    const startYear = start.getUTCFullYear();

    const recurring = await this.prisma.recurringExpense.create({
      data: {
        ...rest,
        startDate: start,
        userId,
        history: {
          create: {
            amount: dto.amount,
            month: startMonth,
            year: startYear,
          },
        },
      },
      include: { bank: true, history: true },
    });

    const generatedCount = await this.generateEntriesSinceStart(
      recurring,
      userId,
      startMonth,
      startYear,
    );

    return { ...recurring, generatedCount };
  }

  async findAllByUser(userId: string, limit?: number, offset?: number) {
    const where = { userId };
    const [data, total] = await Promise.all([
      this.prisma.recurringExpense.findMany({
        where,
        include: {
          bank: true,
          history: { orderBy: [{ year: 'desc' }, { month: 'desc' }] },
        },
        orderBy: [{ isActive: 'desc' }, { dueDay: 'asc' }],
        take: limit,
        skip: offset,
      }),
      this.prisma.recurringExpense.count({ where }),
    ]);
    return new PaginatedResponse(data, total);
  }

  async findOne(id: string, userId: string) {
    const recurring = await this.prisma.recurringExpense.findFirst({
      where: { id, userId },
      include: {
        bank: true,
        history: { orderBy: [{ year: 'desc' }, { month: 'desc' }] },
      },
    });
    if (!recurring) throw new NotFoundException('Recurring expense not found');
    return recurring;
  }

  async update(id: string, userId: string, dto: UpdateRecurringExpenseDto) {
    await this.findOne(id, userId);
    const { startDate, amount, fromMonth, fromYear, ...rest } = dto;

    const now = new Date();
    const refMonth = fromMonth ?? now.getUTCMonth() + 1;
    const refYear = fromYear ?? now.getUTCFullYear();

    const updateData: Record<string, unknown> = {};
    if (rest.name !== undefined) updateData.name = rest.name;
    if (rest.expenseCategory !== undefined)
      updateData.expenseCategory = rest.expenseCategory;
    if (rest.paymentType !== undefined)
      updateData.paymentType = rest.paymentType;
    if (rest.isPriority !== undefined) updateData.isPriority = rest.isPriority;
    if (rest.splitParts !== undefined) updateData.splitParts = rest.splitParts;
    if (rest.userPart !== undefined) updateData.userPart = rest.userPart;
    if (rest.dueDay !== undefined) updateData.dueDay = rest.dueDay;
    if (rest.bankId !== undefined) updateData.bankId = rest.bankId;
    if (rest.isActive !== undefined) updateData.isActive = rest.isActive;
    if (amount !== undefined) updateData.amount = amount;
    if (startDate) updateData.startDate = parseAsUTCDate(startDate);

    await this.prisma.recurringExpense.update({
      where: { id },
      data: updateData,
    });

    if (amount !== undefined) {
      const existingHistory =
        await this.prisma.recurringExpenseHistory.findFirst({
          where: { recurringExpenseId: id, month: refMonth, year: refYear },
        });

      if (existingHistory) {
        await this.prisma.recurringExpenseHistory.update({
          where: { id: existingHistory.id },
          data: { amount },
        });
      } else {
        await this.prisma.recurringExpenseHistory.create({
          data: {
            amount,
            month: refMonth,
            year: refYear,
            recurringExpenseId: id,
          },
        });
      }
    }

    // Recarregar com histórico atualizado
    const recurring = await this.prisma.recurringExpense.findUniqueOrThrow({
      where: { id },
      include: {
        bank: true,
        history: { orderBy: [{ year: 'desc' }, { month: 'desc' }] },
      },
    });

    // Buscar TODOS os entries deste recorrente
    const allEntries = await this.prisma.expenseEntry.findMany({
      where: {
        recurringExpenseId: id,
        createdById: userId,
        deletedAt: null,
        settledAt: null,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Mapear entries existentes por mês/ano
    const existingEntryMap = new Map<string, (typeof allEntries)[0]>();
    for (const entry of allEntries) {
      const key = `${entry.createdAt.getUTCFullYear()}-${entry.createdAt.getUTCMonth() + 1}`;
      existingEntryMap.set(key, entry);
    }

    // Iterar de refMonth/refYear até dezembro do ano corrente
    const endYear = now.getUTCFullYear();
    let m = refMonth;
    let y = refYear;

    while (y < endYear || (y === endYear && m <= 12)) {
      const key = `${y}-${m}`;
      const existing = existingEntryMap.get(key);

      if (existing) {
        const entryAmount = this.getAmountForPeriod(recurring.history, m, y);

        await this.prisma.expenseEntry.update({
          where: { id: existing.id },
          data: {
            amount: entryAmount,
            expenseCategory: recurring.expenseCategory,
            paymentType: recurring.paymentType,
            isPriority: recurring.isPriority,
            splitParts: recurring.splitParts,
            userPart: recurring.userPart,
            bankId: recurring.bankId,
          },
        });
      } else {
        await this.generateEntryForMonth(recurring, userId, m, y);
      }

      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }

    return recurring;
  }

  async remove(id: string, userId: string, month?: number, year?: number) {
    await this.findOne(id, userId);

    const now = new Date();
    const refMonth = month ?? now.getUTCMonth() + 1;
    const refYear = year ?? now.getUTCFullYear();
    const fromDate = createUTCDate(refYear, refMonth - 1);

    // Soft-delete entries do mês informado em diante
    await this.prisma.expenseEntry.updateMany({
      where: {
        recurringExpenseId: id,
        createdById: userId,
        deletedAt: null,
        createdAt: { gte: fromDate },
      },
      data: { deletedAt: now },
    });

    // Desativar e soft-delete o template
    return this.prisma.recurringExpense.update({
      where: { id },
      data: { isActive: false, deletedAt: now },
    });
  }

  async generateMonthlyExpenses(userId: string, month: number, year: number) {
    // 1 query: buscar recorrentes ativos
    const recurringExpenses = await this.prisma.recurringExpense.findMany({
      where: { userId, isActive: true },
      include: {
        history: { orderBy: [{ year: 'desc' }, { month: 'desc' }] },
      },
    });

    if (recurringExpenses.length === 0) {
      return { period: { month, year }, generated: 0, entries: [] };
    }

    // 1 query: buscar todos os entries já gerados do ano para esses recorrentes
    const recurringIds = recurringExpenses.map((r) => r.id);
    const existingEntries = await this.prisma.expenseEntry.findMany({
      where: {
        recurringExpenseId: { in: recurringIds },
        createdById: userId,
        deletedAt: null,
        createdAt: {
          gte: createUTCDate(year, month - 1),
          lt: createUTCDate(year + 1, 0),
        },
      },
      select: { recurringExpenseId: true, createdAt: true },
    });

    // Mapear existentes: "recurringId-mes" → true
    const existingSet = new Set(
      existingEntries.map(
        (e) =>
          `${e.recurringExpenseId}-${e.createdAt.getUTCFullYear()}-${e.createdAt.getUTCMonth() + 1}`,
      ),
    );

    // Montar batch de entries a criar
    const toCreate: Array<{
      amount: Decimal | number;
      expenseCategory: ExpenseCategory | null;
      paymentType: PaymentType | null;
      isPriority: boolean;
      splitParts: number;
      userPart: number;
      bankId: string | null;
      recurringExpenseId: string;
      createdById: string;
      createdAt: Date;
    }> = [];

    for (const recurring of recurringExpenses) {
      const recStartMonth = recurring.startDate.getUTCMonth() + 1;
      const recStartYear = recurring.startDate.getUTCFullYear();

      for (let m = month; m <= 12; m++) {
        const isBeforeStart =
          year < recStartYear || (year === recStartYear && m < recStartMonth);
        if (isBeforeStart) continue;

        const key = `${recurring.id}-${year}-${m}`;
        if (existingSet.has(key)) continue;

        const amount =
          recurring.history && recurring.history.length > 0
            ? this.getAmountForPeriod(recurring.history, m, year)
            : recurring.amount;

        const day = Math.min(
          recurring.dueDay,
          this.getLastDayOfMonth(m, year),
        );

        toCreate.push({
          amount,
          expenseCategory: recurring.expenseCategory,
          paymentType: recurring.paymentType,
          isPriority: recurring.isPriority,
          splitParts: recurring.splitParts,
          userPart: recurring.userPart,
          bankId: recurring.bankId,
          recurringExpenseId: recurring.id,
          createdById: userId,
          createdAt: createUTCDate(year, m - 1, day),
        });
      }
    }

    // 1 query: criar todos de uma vez
    if (toCreate.length > 0) {
      await this.prisma.expenseEntry.createMany({ data: toCreate });
    }

    return {
      period: { month, year },
      generated: toCreate.length,
    };
  }

  private async generateEntriesSinceStart(
    recurring: {
      id: string;
      amount: Decimal;
      expenseCategory: ExpenseCategory | null;
      paymentType: PaymentType | null;
      isPriority: boolean;
      splitParts: number;
      userPart: number;
      bankId: string | null;
      startDate: Date;
      dueDay: number;
      history?: Array<{ amount: Decimal; month: number; year: number }>;
    },
    userId: string,
    startMonth: number,
    startYear: number,
  ) {
    const endYear = new Date().getUTCFullYear();

    // 1 query: buscar entries já existentes deste recorrente
    const existingEntries = await this.prisma.expenseEntry.findMany({
      where: {
        recurringExpenseId: recurring.id,
        createdById: userId,
        deletedAt: null,
      },
      select: { createdAt: true },
    });

    const existingSet = new Set(
      existingEntries.map(
        (e) =>
          `${e.createdAt.getUTCFullYear()}-${e.createdAt.getUTCMonth() + 1}`,
      ),
    );

    const toCreate: Array<{
      amount: Decimal | number;
      expenseCategory: ExpenseCategory | null;
      paymentType: PaymentType | null;
      isPriority: boolean;
      splitParts: number;
      userPart: number;
      bankId: string | null;
      recurringExpenseId: string;
      createdById: string;
      createdAt: Date;
    }> = [];

    let m = startMonth;
    let y = startYear;

    while (y < endYear || (y === endYear && m <= 12)) {
      const key = `${y}-${m}`;
      if (!existingSet.has(key)) {
        const amount =
          recurring.history && recurring.history.length > 0
            ? this.getAmountForPeriod(recurring.history, m, y)
            : recurring.amount;

        const day = Math.min(
          recurring.dueDay,
          this.getLastDayOfMonth(m, y),
        );

        toCreate.push({
          amount,
          expenseCategory: recurring.expenseCategory,
          paymentType: recurring.paymentType,
          isPriority: recurring.isPriority,
          splitParts: recurring.splitParts,
          userPart: recurring.userPart,
          bankId: recurring.bankId,
          recurringExpenseId: recurring.id,
          createdById: userId,
          createdAt: createUTCDate(y, m - 1, day),
        });
      }

      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }

    // 1 query: criar todos de uma vez
    if (toCreate.length > 0) {
      await this.prisma.expenseEntry.createMany({ data: toCreate });
    }

    return toCreate.length;
  }

  private getAmountForPeriod(
    history: Array<{ amount: Decimal; month: number; year: number }>,
    month: number,
    year: number,
  ): Decimal {
    const entry = history.find(
      (h) => h.year < year || (h.year === year && h.month <= month),
    );
    return entry ? entry.amount : history[history.length - 1].amount;
  }

  private async generateEntryForMonth(
    recurring: {
      id: string;
      amount: Decimal;
      expenseCategory: ExpenseCategory | null;
      paymentType: PaymentType | null;
      isPriority: boolean;
      splitParts: number;
      userPart: number;
      bankId: string | null;
      startDate: Date;
      dueDay: number;
      history?: Array<{ amount: Decimal; month: number; year: number }>;
    },
    userId: string,
    month: number,
    year: number,
  ) {
    const recStartMonth = recurring.startDate.getUTCMonth() + 1;
    const recStartYear = recurring.startDate.getUTCFullYear();
    const isBeforeStart =
      year < recStartYear || (year === recStartYear && month < recStartMonth);
    if (isBeforeStart) return null;

    const periodStart = createUTCDate(year, month - 1);
    const periodEnd = createUTCDate(year, month);

    const existing = await this.prisma.expenseEntry.findFirst({
      where: {
        recurringExpenseId: recurring.id,
        createdById: userId,
        deletedAt: null,
        createdAt: {
          gte: periodStart,
          lt: periodEnd,
        },
      },
    });

    if (existing) return null;

    const amount =
      recurring.history && recurring.history.length > 0
        ? this.getAmountForPeriod(recurring.history, month, year)
        : recurring.amount;

    const day = Math.min(recurring.dueDay, this.getLastDayOfMonth(month, year));

    return this.prisma.expenseEntry.create({
      data: {
        amount,
        expenseCategory: recurring.expenseCategory,
        paymentType: recurring.paymentType,
        isPriority: recurring.isPriority,
        splitParts: recurring.splitParts,
        userPart: recurring.userPart,
        bankId: recurring.bankId,
        recurringExpenseId: recurring.id,
        createdById: userId,
        createdAt: createUTCDate(year, month - 1, day),
      },
      include: { bank: true },
    });
  }

  private getLastDayOfMonth(month: number, year: number): number {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
  }
}
