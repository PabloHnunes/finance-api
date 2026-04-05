import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { FinancingsService } from './financings.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  expenseEntry: {
    create: jest.fn(),
    createMany: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
  financingDetail: {
    update: jest.fn(),
  },
};

const mockFinancingDetail = {
  id: 'detail-uuid-1',
  financingType: 'PROPERTY',
  amortizationType: 'SAC',
  totalAmount: 300000,
  interestRate: 0.0075,
  monetaryCorrection: 0,
  totalInstallments: 360,
  paidInstallments: 12,
  startMonth: 1,
  startYear: 2024,
  expenseEntryId: 'entry-uuid-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockEntry = {
  id: 'entry-uuid-1',
  amount: 3083.33,
  expenseCategory: 'FINANCING_PROPERTY',
  isPriority: true,
  installmentGroupId: 'group-uuid-1',
  installmentCount: 360,
  installmentNumber: 13,
  bankId: null,
  bank: null,
  financingDetail: mockFinancingDetail,
  createdById: 'user-uuid-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

describe('FinancingsService', () => {
  let service: FinancingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancingsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<FinancingsService>(FinancingsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('deve criar entries retroativos desde o início até o mês corrente', async () => {
      mockPrisma.expenseEntry.create.mockResolvedValue(mockEntry);

      const result = await service.create('user-uuid-1', {
        description: 'Financiamento Apartamento',
        financingType: 'PROPERTY',
        amortizationType: 'SAC',
        totalAmount: 300000,
        interestRate: 0.0075,
        totalInstallments: 360,
        paidInstallments: 12,
        startMonth: 1,
        startYear: 2024,
      });

      // 1 create para o principal + 1 createMany para o resto
      expect(mockPrisma.expenseEntry.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.expenseEntry.createMany).toHaveBeenCalledTimes(1);

      // Entry principal deve ter financingDetail
      const firstCall = mockPrisma.expenseEntry.create.mock.calls[0][0];
      expect(firstCall.data.installmentNumber).toBe(1);
      expect(firstCall.data.expenseCategory).toBe('FINANCING_PROPERTY');
      expect(firstCall.data.financingDetail).toBeDefined();

      // Segundo entry sem financingDetail
      // createMany deve ter entries com installmentNumber sequencial
      const batchCall = mockPrisma.expenseEntry.createMany.mock.calls[0][0];
      expect(batchCall.data[0].installmentNumber).toBe(2);
      expect(result.generatedCount).toBeGreaterThan(1);
    });

    it('deve usar categoria correta por tipo', async () => {
      mockPrisma.expenseEntry.create.mockResolvedValue(mockEntry);

      await service.create('user-uuid-1', {
        description: 'Carro',
        financingType: 'VEHICLE',
        amortizationType: 'PRICE',
        totalAmount: 60000,
        interestRate: 0.015,
        totalInstallments: 48,
        startMonth: 3,
        startYear: 2026,
      });

      const firstCall = mockPrisma.expenseEntry.create.mock.calls[0][0];
      expect(firstCall.data.expenseCategory).toBe('FINANCING_VEHICLE');
    });

    it('deve criar empréstimo pessoal com categoria LOAN', async () => {
      mockPrisma.expenseEntry.create.mockResolvedValue(mockEntry);

      await service.create('user-uuid-1', {
        description: 'Empréstimo pessoal',
        financingType: 'PERSONAL_LOAN',
        amortizationType: 'PRICE',
        totalAmount: 10000,
        interestRate: 0.02,
        totalInstallments: 24,
        startMonth: 4,
        startYear: 2026,
      });

      const firstCall = mockPrisma.expenseEntry.create.mock.calls[0][0];
      expect(firstCall.data.expenseCategory).toBe('LOAN');
    });
  });

  describe('findAllByUser', () => {
    it('deve retornar financiamentos do usuário', async () => {
      mockPrisma.expenseEntry.findMany.mockResolvedValue([mockEntry]);

      const result = await service.findAllByUser('user-uuid-1');

      expect(mockPrisma.expenseEntry.findMany).toHaveBeenCalledWith({
        where: {
          createdById: 'user-uuid-1',
          deletedAt: null,
          financingDetail: { isNot: null },
        },
        include: { financingDetail: { include: { fees: true } }, bank: true },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('deve retornar financiamento por ID', async () => {
      mockPrisma.expenseEntry.findFirst.mockResolvedValue(mockEntry);

      const result = await service.findOne('entry-uuid-1', 'user-uuid-1');

      expect(result).toEqual(mockEntry);
    });

    it('deve lançar NotFoundException se não encontrar', async () => {
      mockPrisma.expenseEntry.findFirst.mockResolvedValue(null);

      await expect(service.findOne('entry-999', 'user-uuid-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('deve atualizar parcelas pagas e recalcular valor', async () => {
      mockPrisma.expenseEntry.findFirst.mockResolvedValue(mockEntry);
      mockPrisma.financingDetail.update.mockResolvedValue({
        ...mockFinancingDetail,
        paidInstallments: 24,
      });
      mockPrisma.expenseEntry.update.mockResolvedValue({
        ...mockEntry,
        installmentNumber: 25,
      });

      const result = await service.update('entry-uuid-1', 'user-uuid-1', {
        paidInstallments: 24,
      });

      expect(mockPrisma.financingDetail.update).toHaveBeenCalledWith({
        where: { id: 'detail-uuid-1' },
        data: { paidInstallments: 24 },
      });
      expect(mockPrisma.expenseEntry.update).toHaveBeenCalledWith({
        where: { id: 'entry-uuid-1' },
        data: expect.objectContaining({
          installmentNumber: 25,
        }),
        include: {
          financingDetail: { include: { fees: true } },
          bank: true,
        },
      });
    });

    it('deve lançar NotFoundException ao atualizar inexistente', async () => {
      mockPrisma.expenseEntry.findFirst.mockResolvedValue(null);

      await expect(
        service.update('entry-999', 'user-uuid-1', { paidInstallments: 5 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deve soft delete da parcela atual e futuras', async () => {
      mockPrisma.expenseEntry.findFirst.mockResolvedValue(mockEntry);
      mockPrisma.expenseEntry.updateMany.mockResolvedValue({ count: 5 });

      const result = await service.remove('entry-uuid-1', 'user-uuid-1');

      expect(mockPrisma.expenseEntry.updateMany).toHaveBeenCalledWith({
        where: {
          installmentGroupId: mockEntry.installmentGroupId,
          installmentNumber: { gte: mockEntry.installmentNumber },
          deletedAt: null,
        },
        data: { deletedAt: expect.any(Date) },
      });
      expect(result.cancelled).toBe(true);
    });
  });

  describe('removeAll', () => {
    it('deve soft delete todas as parcelas do grupo', async () => {
      mockPrisma.expenseEntry.findFirst.mockResolvedValue(mockEntry);
      mockPrisma.expenseEntry.updateMany.mockResolvedValue({ count: 5 });

      const result = await service.removeAll('entry-uuid-1', 'user-uuid-1');

      expect(mockPrisma.expenseEntry.updateMany).toHaveBeenCalledWith({
        where: {
          installmentGroupId: mockEntry.installmentGroupId,
          deletedAt: null,
        },
        data: { deletedAt: expect.any(Date) },
      });
      expect(result.cancelled).toBe(true);
      expect(result.all).toBe(true);
    });
  });

  describe('getSchedule', () => {
    it('deve retornar tabela SAC com parcelas decrescentes', async () => {
      const sacDetail = {
        ...mockFinancingDetail,
        totalAmount: 120000,
        interestRate: 0.01,
        totalInstallments: 12,
        paidInstallments: 2,
        startMonth: 1,
        startYear: 2026,
      };
      mockPrisma.expenseEntry.findFirst.mockResolvedValue({
        ...mockEntry,
        financingDetail: sacDetail,
      });

      const result = await service.getSchedule('entry-uuid-1', 'user-uuid-1');

      expect(result.schedule).toHaveLength(12);
      expect(result.totalInstallments).toBe(12);
      expect(result.paidInstallments).toBe(2);
      expect(result.schedule[0].status).toBe('PAID');
      expect(result.schedule[1].status).toBe('PAID');
      expect(result.schedule[2].status).toBe('PENDING');

      // SAC: parcelas decrescentes
      expect(result.schedule[0].total).toBeGreaterThan(
        result.schedule[11].total,
      );

      // Amortização constante no SAC
      expect(result.schedule[0].amortization).toBe(
        result.schedule[11].amortization,
      );
    });

    it('deve retornar tabela Price com parcelas fixas', async () => {
      const priceDetail = {
        ...mockFinancingDetail,
        amortizationType: 'PRICE',
        totalAmount: 60000,
        interestRate: 0.015,
        totalInstallments: 48,
        paidInstallments: 0,
        startMonth: 3,
        startYear: 2026,
      };
      mockPrisma.expenseEntry.findFirst.mockResolvedValue({
        ...mockEntry,
        financingDetail: priceDetail,
      });

      const result = await service.getSchedule('entry-uuid-1', 'user-uuid-1');

      expect(result.schedule).toHaveLength(48);
      expect(result.amortizationType).toBe('PRICE');

      // Price: todas as parcelas com mesmo valor total
      expect(result.schedule[0].total).toBe(result.schedule[47].total);
    });

    it('deve calcular totais corretamente', async () => {
      const sacDetail = {
        ...mockFinancingDetail,
        totalAmount: 10000,
        interestRate: 0.01,
        totalInstallments: 10,
        paidInstallments: 5,
        startMonth: 1,
        startYear: 2026,
      };
      mockPrisma.expenseEntry.findFirst.mockResolvedValue({
        ...mockEntry,
        financingDetail: sacDetail,
      });

      const result = await service.getSchedule('entry-uuid-1', 'user-uuid-1');

      expect(result.totalPaid).toBeGreaterThan(0);
      expect(result.totalRemaining).toBeGreaterThan(0);
      expect(result.totalInterest).toBeGreaterThan(0);
      expect(result.totalPaid + result.totalRemaining).toBeCloseTo(
        result.totalAmount + result.totalInterest,
        0,
      );
    });

    it('deve lançar NotFoundException se financiamento não existe', async () => {
      mockPrisma.expenseEntry.findFirst.mockResolvedValue(null);

      await expect(
        service.getSchedule('entry-999', 'user-uuid-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
