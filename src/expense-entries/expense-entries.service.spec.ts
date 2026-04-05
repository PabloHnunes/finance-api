import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ExpenseEntriesService } from './expense-entries.service';
import { PrismaService } from '../prisma/prisma.service';
import { RecurringExpensesService } from '../recurring-expenses/recurring-expenses.service';
import { FinancingsService } from '../financings/financings.service';

const mockPrisma = {
  expenseEntry: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
};

const mockRecurringExpensesService = {
  generateMonthlyExpenses: jest.fn().mockResolvedValue({
    period: { month: 4, year: 2026 },
    generated: 0,
    entries: [],
  }),
};

const mockBank = {
  id: 'bank-uuid-1',
  name: 'Nubank',
};

const mockEntry = {
  id: 'entry-uuid-1',
  amount: 150.5,
  expenseCategory: 'GROCERIES',
  paymentType: 'PIX',
  bankId: 'bank-uuid-1',
  bank: mockBank,
  installmentCount: 1,
  installmentNumber: null,
  createdById: 'user-uuid-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

describe('ExpenseEntriesService', () => {
  let service: ExpenseEntriesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpenseEntriesService,
        { provide: PrismaService, useValue: mockPrisma },
        {
          provide: RecurringExpensesService,
          useValue: mockRecurringExpensesService,
        },
        {
          provide: FinancingsService,
          useValue: {
            generateMonthlyInstallments: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    service = module.get<ExpenseEntriesService>(ExpenseEntriesService);
    jest.clearAllMocks();
    mockPrisma.expenseEntry.count.mockResolvedValue(0);
  });

  describe('create', () => {
    it('deve criar um registro de gasto', async () => {
      mockPrisma.expenseEntry.create.mockResolvedValue(mockEntry);

      const result = await service.create('user-uuid-1', {
        amount: 150.5,
        expenseCategory: 'GROCERIES',
        paymentType: 'PIX',
        bankId: 'bank-uuid-1',
      });

      expect(mockPrisma.expenseEntry.create).toHaveBeenCalledWith({
        data: {
          amount: 150.5,
          expenseCategory: 'GROCERIES',
          paymentType: 'PIX',
          bankId: 'bank-uuid-1',
          createdById: 'user-uuid-1',
        },
        include: {
        bank: true,
        recurringExpense: true,
        financingDetail: { include: { fees: true } },
      },
      });
      expect(result).toEqual(mockEntry);
    });

    it('deve criar gasto sem campos opcionais', async () => {
      const minimalEntry = {
        ...mockEntry,
        expenseCategory: null,
        paymentType: null,
        bankId: null,
        bank: null,
      };
      mockPrisma.expenseEntry.create.mockResolvedValue(minimalEntry);

      const result = await service.create('user-uuid-1', {
        amount: 50,
      });

      expect(mockPrisma.expenseEntry.create).toHaveBeenCalledWith({
        data: {
          amount: 50,
          createdById: 'user-uuid-1',
        },
        include: {
        bank: true,
        recurringExpense: true,
        financingDetail: { include: { fees: true } },
      },
      });
      expect(result).toEqual(minimalEntry);
    });

    it('deve criar gasto com data retroativa', async () => {
      const retroEntry = {
        ...mockEntry,
        createdAt: new Date('2026-03-15T00:00:00.000Z'),
      };
      mockPrisma.expenseEntry.create.mockResolvedValue(retroEntry);

      const result = await service.create('user-uuid-1', {
        amount: 200,
        date: '2026-03-15T00:00:00.000Z',
      });

      expect(mockPrisma.expenseEntry.create).toHaveBeenCalledWith({
        data: {
          amount: 200,
          createdById: 'user-uuid-1',
          createdAt: new Date('2026-03-15T00:00:00.000Z'),
        },
        include: {
        bank: true,
        recurringExpense: true,
        financingDetail: { include: { fees: true } },
      },
      });
      expect(result.createdAt).toEqual(new Date('2026-03-15T00:00:00.000Z'));
    });

    it('deve criar parcelas em meses sequenciais', async () => {
      mockPrisma.expenseEntry.create.mockResolvedValue(mockEntry);

      const result = await service.create('user-uuid-1', {
        amount: 300,
        expenseCategory: 'LEISURE',
        paymentType: 'CREDIT',
        installmentCount: 3,
        date: '2026-01-15T00:00:00.000Z',
      });

      expect(mockPrisma.expenseEntry.create).toHaveBeenCalledTimes(3);

      const calls = mockPrisma.expenseEntry.create.mock.calls;
      expect(calls[0][0].data.amount).toBe(300);
      expect(calls[0][0].data.installmentNumber).toBe(1);
      expect(calls[0][0].data.installmentCount).toBe(3);
      expect(calls[0][0].data.createdAt.getMonth()).toBe(0); // janeiro
      expect(calls[1][0].data.installmentNumber).toBe(2);
      expect(calls[1][0].data.createdAt.getMonth()).toBe(1); // fevereiro
      expect(calls[2][0].data.installmentNumber).toBe(3);
      expect(calls[2][0].data.createdAt.getMonth()).toBe(2); // março

      expect(result).toHaveLength(3);
    });
  });

  describe('findAllByUser', () => {
    it('deve retornar gastos do mês informado e gerar recorrentes', async () => {
      mockPrisma.expenseEntry.findMany.mockResolvedValue([mockEntry]);

      const result = await service.findAllByUser('user-uuid-1', 4, 2026);

      expect(
        mockRecurringExpensesService.generateMonthlyExpenses,
      ).toHaveBeenCalledWith('user-uuid-1', 4, 2026);
      expect(mockPrisma.expenseEntry.findMany).toHaveBeenCalledWith({
        where: {
          createdById: 'user-uuid-1',
          deletedAt: null,
          settledAt: null,
          createdAt: {
            gte: new Date(2026, 3, 1),
            lt: new Date(2026, 4, 1),
          },
        },
        include: {
        bank: true,
        recurringExpense: true,
        financingDetail: { include: { fees: true } },
      },
        orderBy: [{ isPriority: 'desc' }, { createdAt: 'desc' }],
      });
      expect(result.list).toHaveLength(1);
    });

    it('deve retornar todos os gastos quando não informar mês/ano', async () => {
      mockPrisma.expenseEntry.findMany.mockResolvedValue([mockEntry]);

      const result = await service.findAllByUser('user-uuid-1');

      expect(
        mockRecurringExpensesService.generateMonthlyExpenses,
      ).not.toHaveBeenCalled();
      expect(result.list).toHaveLength(1);
    });

    it('deve retornar lista vazia se não há gastos', async () => {
      mockPrisma.expenseEntry.findMany.mockResolvedValue([]);

      const result = await service.findAllByUser('user-uuid-1', 4, 2026);

      expect(result.list).toHaveLength(0);
    });
  });

  describe('findOne', () => {
    it('deve retornar gasto por ID', async () => {
      mockPrisma.expenseEntry.findFirst.mockResolvedValue(mockEntry);

      const result = await service.findOne('entry-uuid-1', 'user-uuid-1');

      expect(mockPrisma.expenseEntry.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'entry-uuid-1',
          createdById: 'user-uuid-1',
          deletedAt: null,
        },
        include: {
        bank: true,
        recurringExpense: true,
        financingDetail: { include: { fees: true } },
      },
      });
      expect(result).toEqual(mockEntry);
    });

    it('deve lançar NotFoundException se gasto não existe', async () => {
      mockPrisma.expenseEntry.findFirst.mockResolvedValue(null);

      await expect(service.findOne('entry-999', 'user-uuid-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('deve atualizar gasto com sucesso', async () => {
      mockPrisma.expenseEntry.findFirst.mockResolvedValue(mockEntry);
      const updated = { ...mockEntry, amount: 200 };
      mockPrisma.expenseEntry.update.mockResolvedValue(updated);

      const result = await service.update('entry-uuid-1', 'user-uuid-1', {
        amount: 200,
      });

      expect(mockPrisma.expenseEntry.update).toHaveBeenCalledWith({
        where: { id: 'entry-uuid-1' },
        data: { amount: 200 },
        include: {
        bank: true,
        recurringExpense: true,
        financingDetail: { include: { fees: true } },
      },
      });
      expect(result.amount).toBe(200);
    });

    it('deve atualizar categoria e tipo de pagamento', async () => {
      mockPrisma.expenseEntry.findFirst.mockResolvedValue(mockEntry);
      const updated = {
        ...mockEntry,
        expenseCategory: 'LEISURE',
        paymentType: 'CREDIT',
      };
      mockPrisma.expenseEntry.update.mockResolvedValue(updated);

      const result = await service.update('entry-uuid-1', 'user-uuid-1', {
        expenseCategory: 'LEISURE',
        paymentType: 'CREDIT',
      });

      expect(result.expenseCategory).toBe('LEISURE');
      expect(result.paymentType).toBe('CREDIT');
    });

    it('deve lançar NotFoundException ao atualizar gasto inexistente', async () => {
      mockPrisma.expenseEntry.findFirst.mockResolvedValue(null);

      await expect(
        service.update('entry-999', 'user-uuid-1', { amount: 100 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('deve propagar splitParts e userPart para parcelas futuras', async () => {
      const installmentEntry = {
        ...mockEntry,
        installmentGroupId: 'group-uuid-1',
        installmentNumber: 3,
        installmentCount: 6,
        financingDetail: null,
      };
      mockPrisma.expenseEntry.findFirst.mockResolvedValue(installmentEntry);
      mockPrisma.expenseEntry.update.mockResolvedValue({
        ...installmentEntry,
        splitParts: 2,
        userPart: 1,
      });
      mockPrisma.expenseEntry.updateMany.mockResolvedValue({ count: 3 });

      await service.update('entry-uuid-1', 'user-uuid-1', {
        splitParts: 2,
        userPart: 1,
      });

      expect(mockPrisma.expenseEntry.updateMany).toHaveBeenCalledWith({
        where: {
          installmentGroupId: 'group-uuid-1',
          installmentNumber: { gt: 3 },
          deletedAt: null,
        },
        data: { splitParts: 2, userPart: 1 },
      });
    });

    it('não deve propagar splitParts para financiamentos', async () => {
      const financingEntry = {
        ...mockEntry,
        installmentGroupId: 'group-uuid-1',
        installmentNumber: 3,
        installmentCount: 360,
        financingDetail: { id: 'detail-1' },
      };
      mockPrisma.expenseEntry.findFirst.mockResolvedValue(financingEntry);
      mockPrisma.expenseEntry.update.mockResolvedValue(financingEntry);

      await service.update('entry-uuid-1', 'user-uuid-1', {
        splitParts: 2,
      });

      expect(mockPrisma.expenseEntry.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deve fazer soft delete do gasto', async () => {
      mockPrisma.expenseEntry.findFirst.mockResolvedValue(mockEntry);
      mockPrisma.expenseEntry.update.mockResolvedValue({
        ...mockEntry,
        deletedAt: new Date(),
      });

      await service.remove('entry-uuid-1', 'user-uuid-1');

      expect(mockPrisma.expenseEntry.update).toHaveBeenCalledWith({
        where: { id: 'entry-uuid-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('deve lançar NotFoundException ao remover gasto inexistente', async () => {
      mockPrisma.expenseEntry.findFirst.mockResolvedValue(null);

      await expect(service.remove('entry-999', 'user-uuid-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
