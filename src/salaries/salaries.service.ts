import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginatedResponse } from '../common/dto/paginated-response.dto';
import { resolveSalaryHistoryEntry } from '../common/utils/salary-resolution.util';
import { CreateSalaryDto } from './dto/create-salary.dto';
import { UpdateSalaryDto } from './dto/update-salary.dto';

@Injectable()
export class SalariesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateSalaryDto) {
    const now = new Date();
    const month = dto.month ?? now.getUTCMonth() + 1;
    const year = dto.year ?? now.getUTCFullYear();

    if (dto.isMain) {
      await this.deactivatePreviousMain(userId, month, year);
    }

    return this.prisma.salary.create({
      data: {
        name: dto.name,
        isMain: dto.isMain ?? false,
        userId,
        history: {
          create: {
            amount: dto.amount,
            month,
            year,
          },
        },
      },
      include: { history: true },
    });
  }

  async findAllByUser(
    userId: string,
    limit?: number,
    offset?: number,
    month?: number,
    year?: number,
  ) {
    const where = { userId, deletedAt: null };
    const [data, total] = await Promise.all([
      this.prisma.salary.findMany({
        where,
        include: {
          history: { orderBy: [{ year: 'desc' }, { month: 'desc' }] },
        },
        take: limit,
        skip: offset,
      }),
      this.prisma.salary.count({ where }),
    ]);

    if (month && year) {
      const filtered = data
        .map((salary) => {
          const entry = resolveSalaryHistoryEntry(salary, month, year);
          return entry ? { ...salary, activeAmount: entry.amount } : null;
        })
        .filter((s) => s !== null);

      return new PaginatedResponse(filtered, filtered.length);
    }

    return new PaginatedResponse(data, total);
  }

  async findOne(id: string, userId: string) {
    const salary = await this.prisma.salary.findFirst({
      where: { id, userId, deletedAt: null },
      include: {
        history: { orderBy: [{ year: 'desc' }, { month: 'desc' }] },
      },
    });
    if (!salary) throw new NotFoundException('Salary not found');
    return salary;
  }

  async update(id: string, userId: string, dto: UpdateSalaryDto) {
    const salary = await this.findOne(id, userId);
    const latestHistory = salary.history[0];

    const salaryData: Record<string, unknown> = {};
    if (dto.name !== undefined) salaryData.name = dto.name;

    if (dto.isMain !== undefined) {
      salaryData.isMain = dto.isMain;
      if (dto.isMain) {
        const effectiveMonth = dto.month ?? latestHistory?.month;
        const effectiveYear = dto.year ?? latestHistory?.year;
        if (effectiveMonth === undefined || effectiveYear === undefined) {
          throw new BadRequestException(
            'No salary history found to determine the reference month/year',
          );
        }
        await this.deactivatePreviousMain(
          userId,
          effectiveMonth,
          effectiveYear,
          id,
        );
        salaryData.isActive = true;
        salaryData.mainUntilMonth = null;
        salaryData.mainUntilYear = null;
      }
    }

    const hasAmountOrDate =
      dto.amount !== undefined ||
      dto.month !== undefined ||
      dto.year !== undefined;

    if (hasAmountOrDate) {
      if (!latestHistory) {
        throw new BadRequestException('No salary history found to update');
      }

      const newMonth = dto.month ?? latestHistory.month;
      const newYear = dto.year ?? latestHistory.year;
      const newAmount = dto.amount ?? Number(latestHistory.amount);

      const hasOtherHistory = salary.history.length > 1;
      if (
        hasOtherHistory &&
        (dto.month !== undefined || dto.year !== undefined)
      ) {
        const secondLatest = salary.history[1];
        const otherIsAfterOrEqual =
          secondLatest.year > newYear ||
          (secondLatest.year === newYear && secondLatest.month >= newMonth);

        if (otherIsAfterOrEqual) {
          throw new BadRequestException(
            'Cannot set date before or equal to a previous history entry',
          );
        }
      }

      await this.prisma.salaryHistory.update({
        where: { id: latestHistory.id },
        data: { amount: newAmount, month: newMonth, year: newYear },
      });
    }

    if (Object.keys(salaryData).length > 0) {
      return this.prisma.salary.update({
        where: { id },
        data: salaryData,
        include: {
          history: { orderBy: [{ year: 'desc' }, { month: 'desc' }] },
        },
      });
    }

    return this.findOne(id, userId);
  }

  private async deactivatePreviousMain(
    userId: string,
    mainUntilMonth: number,
    mainUntilYear: number,
    excludeId?: string,
  ) {
    await this.prisma.salary.updateMany({
      where: {
        userId,
        isMain: true,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      data: { isMain: false, isActive: false, mainUntilMonth, mainUntilYear },
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.salary.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }
}
