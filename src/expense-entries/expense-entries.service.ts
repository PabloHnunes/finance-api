import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RecurringExpensesService } from '../recurring-expenses/recurring-expenses.service';
import { FinancingsService } from '../financings/financings.service';
import { PaginatedResponse } from '../common/dto/paginated-response.dto';
import { CreateExpenseEntryDto } from './dto/create-expense-entry.dto';
import { UpdateExpenseEntryDto } from './dto/update-expense-entry.dto';
import {
  parseAsUTCDate,
  createUTCDate,
  createUTCDateClamped,
} from '../common/utils/date.utils';
import { assertSplitPartsValid } from '../common/validators/split-parts.validator';

@Injectable()
export class ExpenseEntriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recurringExpensesService: RecurringExpensesService,
    private readonly financingsService: FinancingsService,
  ) {}

  async create(userId: string, dto: CreateExpenseEntryDto) {
    const { date, ...rest } = dto;
    const installmentCount = dto.installmentCount ?? 1;

    assertSplitPartsValid(dto.splitParts ?? 1, dto.userPart ?? 1);

    if (installmentCount > 1) {
      return this.createInstallments(userId, rest, date, installmentCount);
    }

    return this.prisma.expenseEntry.create({
      data: {
        ...rest,
        createdById: userId,
        ...(date && { entryDate: parseAsUTCDate(date) }),
      },
      include: {
        bank: true,
        recurringExpense: true,
        financingDetail: { include: { fees: true } },
      },
    });
  }

  private async createInstallments(
    userId: string,
    data: Omit<CreateExpenseEntryDto, 'date' | 'installmentCount'>,
    date: string | undefined,
    installmentCount: number,
  ) {
    const startDate = date ? parseAsUTCDate(date) : new Date();
    const groupId = randomUUID();

    // Uma única transação: se qualquer parcela falhar, nenhuma é gravada.
    return this.prisma.$transaction(
      Array.from({ length: installmentCount }, (_, i) =>
        this.prisma.expenseEntry.create({
          data: {
            ...data,
            amount: data.amount,
            installmentGroupId: groupId,
            installmentCount,
            installmentNumber: i + 1,
            createdById: userId,
            // Dia limitado ao fim do mês para não pular meses curtos.
            entryDate: createUTCDateClamped(
              startDate.getUTCFullYear(),
              startDate.getUTCMonth() + i,
              startDate.getUTCDate(),
            ),
          },
          include: {
            bank: true,
            recurringExpense: true,
            financingDetail: { include: { fees: true } },
          },
        }),
      ),
    );
  }

  async findAllByUser(
    userId: string,
    month?: number,
    year?: number,
    limit?: number,
    offset?: number,
  ) {
    const pagination = { take: limit, skip: offset };

    if (month && year) {
      await Promise.all([
        this.recurringExpensesService.generateMonthlyExpenses(
          userId,
          month,
          year,
        ),
        this.financingsService.generateMonthlyInstallments(userId, month, year),
      ]);

      const startDate = createUTCDate(year, month - 1);
      const endDate = createUTCDate(year, month);
      const where = {
        createdById: userId,
        deletedAt: null,
        settledAt: null,
        entryDate: { gte: startDate, lt: endDate },
      };

      const [data, total] = await Promise.all([
        this.prisma.expenseEntry.findMany({
          where,
          include: {
        bank: true,
        recurringExpense: true,
        financingDetail: { include: { fees: true } },
      },
          orderBy: [{ isPriority: 'desc' }, { entryDate: 'desc' }],
          ...pagination,
        }),
        this.prisma.expenseEntry.count({ where }),
      ]);

      return new PaginatedResponse(
        await this.enrichFinancingDetails(data),
        total,
      );
    }

    const where = {
      createdById: userId,
      deletedAt: null,
      settledAt: null,
    };

    const [data, total] = await Promise.all([
      this.prisma.expenseEntry.findMany({
        where,
        include: {
          bank: true,
          recurringExpense: true,
          financingDetail: { include: { fees: true } },
        },
        orderBy: [{ isPriority: 'desc' }, { entryDate: 'desc' }],
        ...pagination,
      }),
      this.prisma.expenseEntry.count({ where }),
    ]);

    return new PaginatedResponse(
      await this.enrichFinancingDetails(data),
      total,
    );
  }

  private async enrichFinancingDetails<
    T extends {
      installmentGroupId: string | null;
      installmentNumber: number | null;
      installmentCount: number;
      amount: unknown;
      financingDetail: unknown;
    },
  >(entries: T[]) {
    // Encontrar parcelas sem financingDetail mas com grupo
    const orphanGroupIds = [
      ...new Set(
        entries
          .filter((e) => !e.financingDetail && e.installmentGroupId)
          .map((e) => e.installmentGroupId as string),
      ),
    ];

    if (orphanGroupIds.length > 0) {
      // 1 query: buscar financingDetails dos grupos
      const mainEntries = await this.prisma.expenseEntry.findMany({
        where: {
          installmentGroupId: { in: orphanGroupIds },
          financingDetail: { isNot: null },
        },
        include: { financingDetail: { include: { fees: true } } },
      });

      const detailMap = new Map(
        mainEntries.map((e) => [e.installmentGroupId, e.financingDetail]),
      );

      for (let i = 0; i < entries.length; i++) {
        const e = entries[i];
        if (!e.financingDetail && e.installmentGroupId) {
          (entries[i] as any).financingDetail =
            detailMap.get(e.installmentGroupId) ?? null;
        }
      }
    }

    // Reaproveita o mesmo cálculo usado em GET /financings, evitando que as
    // duas rotas divirjam sobre amortizationType, monetaryCorrection e a
    // base de cálculo das fees.
    return entries.map((e) => this.financingsService.enrichFees(e as any));
  }

  async findOne(id: string, userId: string) {
    const entry = await this.prisma.expenseEntry.findFirst({
      where: { id, createdById: userId, deletedAt: null },
      include: {
        bank: true,
        recurringExpense: true,
        financingDetail: { include: { fees: true } },
      },
    });
    if (!entry) throw new NotFoundException('Expense entry not found');
    return entry;
  }

  async update(id: string, userId: string, dto: UpdateExpenseEntryDto) {
    const entry = await this.findOne(id, userId);

    assertSplitPartsValid(
      dto.splitParts ?? entry.splitParts,
      dto.userPart ?? entry.userPart,
    );

    const { date, amount, ...rest } = dto;

    // Financiamentos não podem ter o valor alterado
    const isFinancing = !!entry.financingDetail;
    const data = {
      ...rest,
      ...(amount !== undefined && !isFinancing && { amount }),
      ...(date && { entryDate: parseAsUTCDate(date) }),
    };

    const updated = await this.prisma.expenseEntry.update({
      where: { id },
      data,
      include: {
        bank: true,
        recurringExpense: true,
        financingDetail: { include: { fees: true } },
      },
    });

    // Propagar splitParts/userPart para parcelas futuras do mesmo grupo
    if (
      entry.installmentGroupId &&
      !isFinancing &&
      (dto.splitParts !== undefined || dto.userPart !== undefined)
    ) {
      const futureData: Record<string, unknown> = {};
      if (dto.splitParts !== undefined) futureData.splitParts = dto.splitParts;
      if (dto.userPart !== undefined) futureData.userPart = dto.userPart;

      await this.prisma.expenseEntry.updateMany({
        where: {
          installmentGroupId: entry.installmentGroupId,
          installmentNumber: { gt: entry.installmentNumber ?? 0 },
          deletedAt: null,
        },
        data: futureData,
      });
    }

    return updated;
  }

  async remove(id: string, userId: string, cancelFuture = false) {
    const entry = await this.findOne(id, userId);

    if (cancelFuture && entry.installmentGroupId) {
      await this.prisma.expenseEntry.updateMany({
        where: {
          installmentGroupId: entry.installmentGroupId,
          installmentNumber: { gte: entry.installmentNumber ?? 0 },
          deletedAt: null,
        },
        data: { deletedAt: new Date() },
      });
      return { cancelled: true, fromInstallment: entry.installmentNumber };
    }

    return this.prisma.expenseEntry.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async settleInstallments(id: string, userId: string) {
    const entry = await this.findOne(id, userId);

    if (!entry.installmentGroupId) {
      throw new NotFoundException('Entry is not part of an installment group');
    }

    const now = new Date();

    const nextInstallment = (entry.installmentNumber ?? 0) + 1;

    await this.prisma.expenseEntry.updateMany({
      where: {
        installmentGroupId: entry.installmentGroupId,
        installmentNumber: { gte: nextInstallment },
        deletedAt: null,
        settledAt: null,
      },
      data: { settledAt: now },
    });

    return { settled: true, fromInstallment: nextInstallment };
  }
}
