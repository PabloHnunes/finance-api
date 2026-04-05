import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ExpenseCategory, PaymentType } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFinancingDto } from './dto/create-financing.dto';
import { UpdateFinancingDto } from './dto/update-financing.dto';

@Injectable()
export class FinancingsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateFinancingDto) {
    const categoryMap: Record<string, ExpenseCategory> = {
      PROPERTY: ExpenseCategory.FINANCING_PROPERTY,
      VEHICLE: ExpenseCategory.FINANCING_VEHICLE,
      PERSONAL_LOAN: ExpenseCategory.LOAN,
    };
    const expenseCategory: ExpenseCategory =
      dto.expenseCategory ??
      categoryMap[dto.financingType] ??
      ExpenseCategory.LOAN;

    const interestRate = this.resolveMonthlyRate(dto);
    const paidInstallments = dto.paidInstallments ?? 0;
    const mc = dto.monetaryCorrection ?? 0;
    const groupId = randomUUID();

    // Converter fees: valor em reais → taxa proporcional
    const firstBaseAmount = this.calculateInstallmentAmount(
      dto.amortizationType,
      Number(dto.totalAmount),
      interestRate,
      dto.totalInstallments,
      1,
      mc,
    );
    const fees = this.convertFeesToRates(
      dto.fees ?? [],
      Number(dto.totalAmount),
      firstBaseAmount,
    );

    const firstFees = this.calculateFees(
      fees,
      Number(dto.totalAmount),
      firstBaseAmount,
      Number(dto.totalAmount),
    );
    const firstAmount = firstBaseAmount + firstFees;

    // Calcular todas as parcelas sequencialmente (evita recalcular o loop inteiro para cada parcela)
    const allInstallments = this.calculateAllInstallments(
      dto.amortizationType,
      Number(dto.totalAmount),
      interestRate,
      dto.totalInstallments,
      mc,
      fees,
    );

    // Criar entry principal com financingDetail
    const mainEntry = await this.prisma.expenseEntry.create({
      data: {
        amount: allInstallments[0].total,
        expenseCategory,
        paymentType: dto.paymentType,
        isPriority: true,
        splitParts: dto.splitParts,
        userPart: dto.userPart,
        installmentGroupId: groupId,
        installmentCount: dto.totalInstallments,
        installmentNumber: 1,
        bankId: dto.bankId,
        createdById: userId,
        createdAt: new Date(dto.startYear, dto.startMonth - 1, 1),
        financingDetail: {
          create: {
            description: dto.description,
            financingType: dto.financingType,
            amortizationType: dto.amortizationType,
            totalAmount: dto.totalAmount,
            interestRate,
            monetaryCorrection: mc,
            totalInstallments: dto.totalInstallments,
            paidInstallments,
            startMonth: dto.startMonth,
            startYear: dto.startYear,
            ...(fees.length > 0 && {
              fees: {
                create: fees.map((f) => ({
                  name: f.name,
                  type: f.type as 'FIXED' | 'ON_BALANCE' | 'ON_INSTALLMENT' | 'ON_TOTAL_AMOUNT',
                  value: f.value,
                })),
              },
            }),
          },
        },
      },
      include: { financingDetail: { include: { fees: true } }, bank: true },
    });

    // Gerar entries retroativos até dezembro do ano corrente (batch)
    const now = new Date();
    const endYear = now.getFullYear();
    const toCreate: Array<{
      amount: number;
      expenseCategory: ExpenseCategory;
      paymentType?: PaymentType;
      isPriority: boolean;
      splitParts: number;
      userPart: number;
      installmentGroupId: string;
      installmentCount: number;
      installmentNumber: number;
      bankId: string | null;
      createdById: string;
      createdAt: Date;
    }> = [];

    let m = dto.startMonth;
    let y = dto.startYear;

    for (let i = 2; i <= dto.totalInstallments; i++) {
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }

      if (y > endYear || (y === endYear && m > 12)) break;

      toCreate.push({
        amount: allInstallments[i - 1].total,
        expenseCategory,
        paymentType: dto.paymentType,
        isPriority: true,
        splitParts: dto.splitParts ?? 1,
        userPart: dto.userPart ?? 1,
        installmentGroupId: groupId,
        installmentCount: dto.totalInstallments,
        installmentNumber: i,
        bankId: dto.bankId ?? null,
        createdById: userId,
        createdAt: new Date(y, m - 1, 1),
      });
    }

    if (toCreate.length > 0) {
      await this.prisma.expenseEntry.createMany({ data: toCreate });
    }

    return { ...mainEntry, generatedCount: toCreate.length + 1 };
  }

  async findAllByUser(userId: string) {
    const mainEntries = await this.prisma.expenseEntry.findMany({
      where: {
        createdById: userId,
        deletedAt: null,
        financingDetail: { isNot: null },
      },
      include: { financingDetail: { include: { fees: true } }, bank: true },
      orderBy: { createdAt: 'desc' },
    });

    return mainEntries.map((entry) => this.enrichFees(entry));
  }

  async findInstallments(id: string, userId: string) {
    const entry = await this.findOne(id, userId);

    if (!entry.installmentGroupId) return [entry];

    return this.prisma.expenseEntry.findMany({
      where: {
        installmentGroupId: entry.installmentGroupId,
        createdById: userId,
        deletedAt: null,
      },
      include: { financingDetail: true, bank: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string, userId: string) {
    // Primeiro tenta buscar diretamente (pode ser entry principal ou parcela)
    const entry = await this.prisma.expenseEntry.findFirst({
      where: { id, createdById: userId, deletedAt: null },
      include: { financingDetail: { include: { fees: true } }, bank: true },
    });
    if (!entry) throw new NotFoundException('Financing not found');

    // Se não tem financingDetail, buscar o principal pelo installmentGroupId
    if (!entry.financingDetail && entry.installmentGroupId) {
      const mainEntry = await this.prisma.expenseEntry.findFirst({
        where: {
          installmentGroupId: entry.installmentGroupId,
          financingDetail: { isNot: null },
        },
        include: { financingDetail: { include: { fees: true } } },
      });
      return { ...entry, financingDetail: mainEntry?.financingDetail ?? null };
    }

    return entry;
  }

  async update(id: string, userId: string, dto: UpdateFinancingDto) {
    const entry = await this.findOne(id, userId);
    const detail = entry.financingDetail!;

    const updateData: Record<string, unknown> = {};
    const detailData: Record<string, unknown> = {};

    if (dto.bankId !== undefined) updateData.bankId = dto.bankId;
    if (dto.splitParts !== undefined) updateData.splitParts = dto.splitParts;
    if (dto.userPart !== undefined) updateData.userPart = dto.userPart;
    if (dto.description !== undefined) detailData.description = dto.description;

    if (dto.paidInstallments !== undefined) {
      detailData.paidInstallments = dto.paidInstallments;
      updateData.installmentNumber = dto.paidInstallments + 1;
    }

    if (dto.interestRate !== undefined) {
      detailData.interestRate = dto.interestRate;
    }

    // Só recalcular amount se paidInstallments ou interestRate mudaram
    if (dto.paidInstallments !== undefined || dto.interestRate !== undefined) {
      const paidInstallments = dto.paidInstallments ?? detail.paidInstallments;
      const interestRate = dto.interestRate ?? Number(detail.interestRate);
      const currentInstallment = paidInstallments + 1;

      if (currentInstallment <= detail.totalInstallments) {
        const detailFees = (detail as any).fees ?? [];
        const allInstallments = this.calculateAllInstallments(
          detail.amortizationType,
          Number(detail.totalAmount),
          interestRate,
          detail.totalInstallments,
          Number(detail.monetaryCorrection),
          detailFees,
        );
        updateData.amount = allInstallments[currentInstallment - 1].total;
      }
    }

    if (Object.keys(detailData).length > 0) {
      await this.prisma.financingDetail.update({
        where: { id: detail.id },
        data: detailData,
      });
    }

    // Atualizar entry principal
    if (Object.keys(updateData).length > 0) {
      await this.prisma.expenseEntry.update({
        where: { id },
        data: updateData,
        include: { financingDetail: { include: { fees: true } }, bank: true },
      });
    }

    // Propagar splitParts/userPart/bankId para parcelas do grupo a partir de fromMonth/fromYear
    const hasPropagation =
      dto.splitParts !== undefined ||
      dto.userPart !== undefined ||
      dto.bankId !== undefined;

    if (hasPropagation && entry.installmentGroupId) {
      const propagateData: Record<string, unknown> = {};
      if (dto.splitParts !== undefined) propagateData.splitParts = dto.splitParts;
      if (dto.userPart !== undefined) propagateData.userPart = dto.userPart;
      if (dto.bankId !== undefined) propagateData.bankId = dto.bankId;

      const now = new Date();
      const fromMonth = dto.fromMonth ?? now.getUTCMonth() + 1;
      const fromYear = dto.fromYear ?? now.getUTCFullYear();

      // Buscar entries do grupo e filtrar por mês/ano
      const allGroupEntries = await this.prisma.expenseEntry.findMany({
        where: {
          installmentGroupId: entry.installmentGroupId,
          createdById: userId,
          deletedAt: null,
        },
        select: { id: true, createdAt: true },
      });

      const idsToUpdate = allGroupEntries
        .filter((e) => {
          const m = e.createdAt.getUTCMonth() + 1;
          const y = e.createdAt.getUTCFullYear();
          return y > fromYear || (y === fromYear && m >= fromMonth);
        })
        .map((e) => e.id);

      if (idsToUpdate.length > 0) {
        await this.prisma.expenseEntry.updateMany({
          where: { id: { in: idsToUpdate } },
          data: propagateData,
        });
      }
    }

    return this.findOne(id, userId);
  }

  async getSchedule(id: string, userId: string) {
    const entry = await this.findOne(id, userId);
    const detail = entry.financingDetail!;

    const totalAmount = Number(detail.totalAmount);
    const interestRate = Number(detail.interestRate);
    const mc = Number(detail.monetaryCorrection);
    const detailFees = (detail as any).fees ?? [];
    const { totalInstallments, paidInstallments, amortizationType } = detail;

    const allInstallments = this.calculateAllInstallments(
      amortizationType,
      totalAmount,
      interestRate,
      totalInstallments,
      mc,
      detailFees,
    );

    const schedule: Array<{
      number: number;
      month: number;
      year: number;
      amortization: number;
      interest: number;
      fees: number;
      total: number;
      outstandingBalance: number;
      status: string;
    }> = [];
    let month = detail.startMonth;
    let year = detail.startYear;

    for (let i = 0; i < totalInstallments; i++) {
      const inst = allInstallments[i];
      schedule.push({
        number: i + 1,
        month,
        year,
        amortization: inst.amortization,
        interest: inst.interest,
        fees: inst.feesAmount,
        total: inst.total,
        outstandingBalance: inst.outstandingBalance,
        status: i + 1 <= paidInstallments ? 'PAID' : 'PENDING',
      });

      month++;
      if (month > 12) {
        month = 1;
        year++;
      }
    }

    const totalPaid = schedule
      .filter((s) => s.status === 'PAID')
      .reduce((sum, s) => sum + s.total, 0);

    const totalRemaining = schedule
      .filter((s) => s.status === 'PENDING')
      .reduce((sum, s) => sum + s.total, 0);

    const totalInterest = schedule.reduce((sum, s) => sum + s.interest, 0);

    return {
      financingType: detail.financingType,
      amortizationType,
      totalAmount,
      interestRate,
      totalInstallments,
      paidInstallments,
      totalPaid: Math.round(totalPaid * 100) / 100,
      totalRemaining: Math.round(totalRemaining * 100) / 100,
      totalInterest: Math.round(totalInterest * 100) / 100,
      schedule,
    };
  }

  async remove(id: string, userId: string, cancelFuture = true) {
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

  async removeAll(id: string, userId: string) {
    const entry = await this.findOne(id, userId);

    if (entry.installmentGroupId) {
      await this.prisma.expenseEntry.updateMany({
        where: {
          installmentGroupId: entry.installmentGroupId,
          deletedAt: null,
        },
        data: { deletedAt: new Date() },
      });
      return { cancelled: true, all: true };
    }

    return this.prisma.expenseEntry.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async generateMonthlyInstallments(
    userId: string,
    month: number,
    year: number,
  ) {
    const mainEntries = await this.prisma.expenseEntry.findMany({
      where: {
        createdById: userId,
        deletedAt: null,
        financingDetail: { isNot: null },
      },
      include: { financingDetail: { include: { fees: true } } },
    });

    if (mainEntries.length === 0) return 0;

    const groupIds = mainEntries
      .map((e) => e.installmentGroupId)
      .filter((id): id is string => id !== null);

    const existingEntries = await this.prisma.expenseEntry.findMany({
      where: {
        installmentGroupId: { in: groupIds },
        createdById: userId,
        deletedAt: null,
        createdAt: {
          gte: new Date(year, month - 1, 1),
          lt: new Date(year + 1, 0, 1),
        },
      },
      select: { installmentGroupId: true, installmentNumber: true },
    });

    const existingSet = new Set(
      existingEntries.map(
        (e) => `${e.installmentGroupId}-${e.installmentNumber}`,
      ),
    );

    const toCreate: Array<{
      amount: number;
      expenseCategory: (typeof mainEntries)[0]['expenseCategory'];
      paymentType: (typeof mainEntries)[0]['paymentType'];
      isPriority: boolean;
      splitParts: number;
      userPart: number;
      installmentGroupId: string;
      installmentCount: number;
      installmentNumber: number;
      bankId: string | null;
      createdById: string;
      createdAt: Date;
    }> = [];

    for (const main of mainEntries) {
      const detail = main.financingDetail!;
      if (!main.installmentGroupId) continue;

      const detailFees = (detail as any).fees ?? [];
      const allInstallments = this.calculateAllInstallments(
        detail.amortizationType,
        Number(detail.totalAmount),
        Number(detail.interestRate),
        detail.totalInstallments,
        Number(detail.monetaryCorrection),
        detailFees,
      );

      for (let targetMonth = month; targetMonth <= 12; targetMonth++) {
        let m = detail.startMonth;
        let y = detail.startYear;
        let installmentNumber = 0;

        for (let i = 1; i <= detail.totalInstallments; i++) {
          if (m === targetMonth && y === year) {
            installmentNumber = i;
            break;
          }
          m++;
          if (m > 12) {
            m = 1;
            y++;
          }
        }

        if (installmentNumber === 0) continue;

        const key = `${main.installmentGroupId}-${installmentNumber}`;
        if (existingSet.has(key)) continue;

        toCreate.push({
          amount: allInstallments[installmentNumber - 1].total,
          expenseCategory: main.expenseCategory,
          paymentType: main.paymentType,
          isPriority: main.isPriority,
          splitParts: main.splitParts,
          userPart: main.userPart,
          installmentGroupId: main.installmentGroupId,
          installmentCount: detail.totalInstallments,
          installmentNumber,
          bankId: main.bankId,
          createdById: userId,
          createdAt: new Date(year, targetMonth - 1, 1),
        });
      }
    }

    if (toCreate.length > 0) {
      await this.prisma.expenseEntry.createMany({ data: toCreate });
    }

    return toCreate.length;
  }

  private calculateInstallmentAmount(
    type: string,
    totalAmount: number,
    interestRate: number,
    totalInstallments: number,
    installmentNumber: number,
    monetaryCorrection = 0,
  ): number {
    const detail = this.calculateInstallmentDetail(
      type,
      totalAmount,
      interestRate,
      totalInstallments,
      installmentNumber,
      monetaryCorrection,
    );
    return detail.total;
  }

  private calculateAllInstallments(
    type: string,
    totalAmount: number,
    interestRate: number,
    totalInstallments: number,
    monetaryCorrection: number,
    fees: Array<{ name: string; type: string; value: unknown }>,
  ) {
    const results: Array<{
      amortization: number;
      interest: number;
      feesAmount: number;
      total: number;
      outstandingBalance: number;
    }> = [];

    let saldo = totalAmount;

    for (let i = 1; i <= totalInstallments; i++) {
      // Correção monetária
      saldo *= 1 + monetaryCorrection;

      let amortization: number;
      let interest: number;

      if (type === 'SAC') {
        const remaining = totalInstallments - (i - 1);
        amortization = saldo / remaining;
        interest = saldo * interestRate;
      } else {
        // Price: recalcular parcela com saldo corrigido
        const remaining = totalInstallments - (i - 1);
        const payment =
          saldo *
          ((interestRate * Math.pow(1 + interestRate, remaining)) /
            (Math.pow(1 + interestRate, remaining) - 1));
        interest = saldo * interestRate;
        amortization = payment - interest;
      }

      const baseTotal = amortization + interest;
      const feesAmount = this.calculateFees(
        fees,
        saldo,
        baseTotal,
        totalAmount,
      );

      results.push({
        amortization: Math.round(amortization * 100) / 100,
        interest: Math.round(interest * 100) / 100,
        feesAmount: Math.round(feesAmount * 100) / 100,
        total: Math.round((baseTotal + feesAmount) * 100) / 100,
        outstandingBalance: Math.round((saldo - amortization) * 100) / 100,
      });

      saldo -= amortization;
    }

    return results;
  }

  private calculateInstallmentDetail(
    type: string,
    totalAmount: number,
    interestRate: number,
    totalInstallments: number,
    installmentNumber: number,
    monetaryCorrection = 0,
  ) {
    if (type === 'SAC') {
      return this.calculateSAC(
        totalAmount,
        interestRate,
        totalInstallments,
        installmentNumber,
        monetaryCorrection,
      );
    }
    return this.calculatePrice(
      totalAmount,
      interestRate,
      totalInstallments,
      installmentNumber,
      monetaryCorrection,
    );
  }

  private calculateSAC(
    totalAmount: number,
    interestRate: number,
    totalInstallments: number,
    installmentNumber: number,
    monetaryCorrection = 0,
  ) {
    // Simular saldo com correção monetária mês a mês
    let outstandingBalance = totalAmount;

    for (let i = 1; i < installmentNumber; i++) {
      // Corrige saldo pela TR
      outstandingBalance *= 1 + monetaryCorrection;
      // Amortiza: saldo corrigido / parcelas restantes
      const remainingInstallments = totalInstallments - (i - 1);
      const amort = outstandingBalance / remainingInstallments;
      outstandingBalance -= amort;
    }

    // Parcela atual
    outstandingBalance *= 1 + monetaryCorrection;
    const remainingInstallments = totalInstallments - (installmentNumber - 1);
    const amortization = outstandingBalance / remainingInstallments;
    const interest = outstandingBalance * interestRate;
    const total = amortization + interest;

    return {
      amortization: Math.round(amortization * 100) / 100,
      interest: Math.round(interest * 100) / 100,
      total: Math.round(total * 100) / 100,
      outstandingBalance:
        Math.round((outstandingBalance - amortization) * 100) / 100,
    };
  }

  private calculatePrice(
    totalAmount: number,
    interestRate: number,
    totalInstallments: number,
    installmentNumber: number,
    monetaryCorrection = 0,
  ) {
    // Price sem TR = parcela fixa
    // Price com TR = saldo corrigido todo mês, parcela recalculada
    let outstandingBalance = totalAmount;

    for (let i = 1; i < installmentNumber; i++) {
      outstandingBalance *= 1 + monetaryCorrection;
      const remaining = totalInstallments - (i - 1);
      const payment =
        outstandingBalance *
        ((interestRate * Math.pow(1 + interestRate, remaining)) /
          (Math.pow(1 + interestRate, remaining) - 1));
      const interest = outstandingBalance * interestRate;
      const amort = payment - interest;
      outstandingBalance -= amort;
    }

    outstandingBalance *= 1 + monetaryCorrection;
    const remaining = totalInstallments - (installmentNumber - 1);
    const total =
      outstandingBalance *
      ((interestRate * Math.pow(1 + interestRate, remaining)) /
        (Math.pow(1 + interestRate, remaining) - 1));
    const interest = outstandingBalance * interestRate;
    const amortization = total - interest;

    return {
      amortization: Math.round(amortization * 100) / 100,
      interest: Math.round(interest * 100) / 100,
      total: Math.round(total * 100) / 100,
      outstandingBalance:
        Math.round((outstandingBalance - amortization) * 100) / 100,
    };
  }

  private resolveMonthlyRate(dto: {
    interestRate?: number;
    nominalAnnualRate?: number;
    effectiveAnnualRate?: number;
  }): number {
    if (dto.interestRate !== undefined) {
      return dto.interestRate;
    }
    if (dto.effectiveAnnualRate !== undefined) {
      return Math.pow(1 + dto.effectiveAnnualRate, 1 / 12) - 1;
    }
    if (dto.nominalAnnualRate !== undefined) {
      return dto.nominalAnnualRate / 12;
    }
    throw new BadRequestException(
      'Informe interestRate, nominalAnnualRate ou effectiveAnnualRate',
    );
  }

  private calculateFees(
    fees: Array<{ name: string; type: string; value: unknown }>,
    outstandingBalance: number,
    installmentAmount: number,
    totalAmount: number,
  ): number {
    let total = 0;
    for (const fee of fees) {
      const value = Number(fee.value);
      switch (fee.type) {
        case 'FIXED':
          total += value;
          break;
        case 'ON_BALANCE':
          total += outstandingBalance * value;
          break;
        case 'ON_INSTALLMENT':
          total += installmentAmount * value;
          break;
        case 'ON_TOTAL_AMOUNT':
          total += totalAmount * value;
          break;
      }
    }
    return Math.round(total * 100) / 100;
  }

  private enrichFees<
    T extends {
      installmentNumber: number | null;
      amount: unknown;
      financingDetail: {
        totalAmount: unknown;
        interestRate: unknown;
        totalInstallments: number;
        monetaryCorrection: unknown;
        fees: Array<{ name: string; type: string; value: unknown }>;
      } | null;
    },
  >(entry: T) {
    const detail = entry.financingDetail;
    if (!detail?.fees?.length) return entry;

    const totalAmount = Number(detail.totalAmount);
    const interestRate = Number(detail.interestRate);
    const mc = Number(detail.monetaryCorrection);
    const installmentNumber = entry.installmentNumber ?? 1;

    // Usar calculateAllInstallments para obter saldo exato da parcela
    const allInstallments = this.calculateAllInstallments(
      'SAC',
      totalAmount,
      interestRate,
      detail.totalInstallments,
      mc,
      [],
    );

    const inst = allInstallments[installmentNumber - 1];
    const balance = inst
      ? inst.outstandingBalance + inst.amortization
      : totalAmount;

    const enrichedFees = detail.fees.map((fee) => {
      const rate = Number(fee.value);
      let calculatedValue: number;

      switch (fee.type) {
        case 'FIXED':
          calculatedValue = rate;
          break;
        case 'ON_BALANCE':
          calculatedValue = Math.round(balance * rate * 100) / 100;
          break;
        case 'ON_INSTALLMENT':
          calculatedValue = Math.round(Number(entry.amount) * rate * 100) / 100;
          break;
        case 'ON_TOTAL_AMOUNT':
          calculatedValue = Math.round(totalAmount * rate * 100) / 100;
          break;
        default:
          calculatedValue = rate;
      }

      return { ...fee, calculatedValue };
    });

    return {
      ...entry,
      financingDetail: { ...detail, fees: enrichedFees },
    };
  }

  private convertFeesToRates(
    inputFees: Array<{ name: string; type: string; value: number }>,
    totalAmount: number,
    firstInstallmentAmount: number,
  ): Array<{ name: string; type: string; value: number }> {
    return inputFees.map((fee) => {
      if (fee.type === 'FIXED') return fee;

      // Para taxas proporcionais, o usuário informa o valor em reais da 1ª parcela
      // Convertemos para a taxa dividindo pela base correspondente
      let rate: number;
      switch (fee.type) {
        case 'ON_BALANCE':
          rate = fee.value / totalAmount;
          break;
        case 'ON_INSTALLMENT':
          rate = fee.value / firstInstallmentAmount;
          break;
        case 'ON_TOTAL_AMOUNT':
          rate = fee.value / totalAmount;
          break;
        default:
          rate = fee.value;
      }

      return { name: fee.name, type: fee.type, value: rate };
    });
  }
}
