import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { RecurringExpensesService } from './recurring-expenses.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  recurringExpense: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  recurringExpenseHistory: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  expenseEntry: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
};

const mockHistory = [{ id: 'hist-1', amount: 120, month: 1, year: 2026 }];

const mockRecurring = {
  id: 'recurring-uuid-1',
  name: 'Internet',
  amount: 120,
  expenseCategory: 'UTILITIES',
  paymentType: 'BOLETO',
  isPriority: true,
  dueDay: 10,
  splitParts: 1,
  userPart: 1,
  startDate: new Date('2026-01-01'),
  isActive: true,
  bankId: null,
  bank: null,
  history: mockHistory,
  userId: 'user-uuid-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('RecurringExpensesService', () => {
  let service: RecurringExpensesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecurringExpensesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<RecurringExpensesService>(RecurringExpensesService);
    jest.clearAllMocks();
    mockPrisma.expenseEntry.findFirst.mockResolvedValue(null);
    mockPrisma.expenseEntry.findMany.mockResolvedValue([]);
    mockPrisma.recurringExpense.count.mockResolvedValue(0);
  });

  describe('create', () => {
    it('deve criar recorrente com histórico inicial', async () => {
      mockPrisma.recurringExpense.create.mockResolvedValue(mockRecurring);
      mockPrisma.expenseEntry.create.mockResolvedValue({});

      await service.create('user-uuid-1', {
        name: 'Internet',
        amount: 120,
        expenseCategory: 'UTILITIES',
        paymentType: 'BOLETO',
        isPriority: true,
        dueDay: 10,
        startDate: '2026-01-01',
      });

      const callData = mockPrisma.recurringExpense.create.mock.calls[0][0];
      expect(callData.data.name).toBe('Internet');
      expect(callData.data.amount).toBe(120);
      expect(callData.data.userId).toBe('user-uuid-1');
      expect(callData.data.history.create.amount).toBe(120);
      expect(callData.include).toEqual({ bank: true, history: true });
    });
  });

  describe('findAllByUser', () => {
    it('deve retornar recorrentes com histórico ordenado', async () => {
      mockPrisma.recurringExpense.findMany.mockResolvedValue([mockRecurring]);

      const result = await service.findAllByUser('user-uuid-1');

      expect(mockPrisma.recurringExpense.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-uuid-1' },
        include: {
          bank: true,
          history: { orderBy: [{ year: 'desc' }, { month: 'desc' }] },
        },
        orderBy: [{ isActive: 'desc' }, { dueDay: 'asc' }],
      });
      expect(result.list).toHaveLength(1);
    });

    it('deve retornar lista vazia', async () => {
      mockPrisma.recurringExpense.findMany.mockResolvedValue([]);

      const result = await service.findAllByUser('user-uuid-1');

      expect(result.list).toHaveLength(0);
    });
  });

  describe('findOne', () => {
    it('deve retornar recorrente por ID', async () => {
      mockPrisma.recurringExpense.findFirst.mockResolvedValue(mockRecurring);

      const result = await service.findOne('recurring-uuid-1', 'user-uuid-1');

      expect(result).toEqual(mockRecurring);
    });

    it('deve lançar NotFoundException', async () => {
      mockPrisma.recurringExpense.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne('recurring-999', 'user-uuid-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('deve criar novo histórico ao atualizar valor', async () => {
      mockPrisma.recurringExpense.findFirst.mockResolvedValue(mockRecurring);
      mockPrisma.recurringExpense.update.mockResolvedValue(mockRecurring);
      mockPrisma.recurringExpenseHistory.findFirst.mockResolvedValue(null);
      mockPrisma.recurringExpenseHistory.create.mockResolvedValue({});
      mockPrisma.recurringExpense.findUniqueOrThrow.mockResolvedValue({
        ...mockRecurring,
        amount: 150,
        history: [
          {
            id: 'hist-new',
            amount: 150,
            month: new Date().getMonth() + 1,
            year: new Date().getFullYear(),
          },
          { id: 'hist-1', amount: 120, month: 1, year: 2026 },
        ],
      });

      await service.update('recurring-uuid-1', 'user-uuid-1', {
        amount: 150,
      });

      expect(mockPrisma.recurringExpenseHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          amount: 150,
          recurringExpenseId: 'recurring-uuid-1',
        }),
      });
    });

    it('deve atualizar histórico existente do mesmo mês', async () => {
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      mockPrisma.recurringExpense.findFirst.mockResolvedValue(mockRecurring);
      mockPrisma.recurringExpense.update.mockResolvedValue(mockRecurring);
      mockPrisma.recurringExpenseHistory.findFirst.mockResolvedValue({
        id: 'hist-current',
        amount: 120,
        month: currentMonth,
        year: currentYear,
      });
      mockPrisma.recurringExpenseHistory.update.mockResolvedValue({});
      mockPrisma.recurringExpense.findUniqueOrThrow.mockResolvedValue({
        ...mockRecurring,
        amount: 150,
        history: [
          {
            id: 'hist-current',
            amount: 150,
            month: currentMonth,
            year: currentYear,
          },
        ],
      });

      await service.update('recurring-uuid-1', 'user-uuid-1', {
        amount: 150,
      });

      expect(mockPrisma.recurringExpenseHistory.update).toHaveBeenCalledWith({
        where: { id: 'hist-current' },
        data: { amount: 150 },
      });
    });

    it('deve desativar gasto recorrente', async () => {
      mockPrisma.recurringExpense.findFirst.mockResolvedValue(mockRecurring);
      mockPrisma.recurringExpense.update.mockResolvedValue(mockRecurring);
      mockPrisma.recurringExpense.findUniqueOrThrow.mockResolvedValue({
        ...mockRecurring,
        isActive: false,
      });

      const result = await service.update('recurring-uuid-1', 'user-uuid-1', {
        isActive: false,
      });

      expect(result.isActive).toBe(false);
    });

    it('deve lançar NotFoundException ao atualizar inexistente', async () => {
      mockPrisma.recurringExpense.findFirst.mockResolvedValue(null);

      await expect(
        service.update('recurring-999', 'user-uuid-1', { amount: 100 }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deve desativar recorrente e soft-deletar entries do mês informado em diante', async () => {
      mockPrisma.recurringExpense.findFirst.mockResolvedValue(mockRecurring);
      mockPrisma.recurringExpense.update.mockResolvedValue({
        ...mockRecurring,
        isActive: false,
      });

      await service.remove('recurring-uuid-1', 'user-uuid-1', 3, 2026);

      expect(mockPrisma.expenseEntry.updateMany).toHaveBeenCalledWith({
        where: {
          recurringExpenseId: 'recurring-uuid-1',
          createdById: 'user-uuid-1',
          deletedAt: null,
          createdAt: { gte: new Date(2026, 2, 1) },
        },
        data: { deletedAt: expect.any(Date) },
      });
      expect(mockPrisma.recurringExpense.update).toHaveBeenCalledWith({
        where: { id: 'recurring-uuid-1' },
        data: { isActive: false, deletedAt: expect.any(Date) },
      });
    });

    it('deve usar mês atual quando não informado', async () => {
      mockPrisma.recurringExpense.findFirst.mockResolvedValue(mockRecurring);
      mockPrisma.recurringExpense.update.mockResolvedValue({
        ...mockRecurring,
        isActive: false,
      });

      await service.remove('recurring-uuid-1', 'user-uuid-1');

      const now = new Date();
      const fromDate = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1);

      expect(mockPrisma.expenseEntry.updateMany).toHaveBeenCalledWith({
        where: {
          recurringExpenseId: 'recurring-uuid-1',
          createdById: 'user-uuid-1',
          deletedAt: null,
          createdAt: { gte: fromDate },
        },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('deve lançar NotFoundException ao deletar inexistente', async () => {
      mockPrisma.recurringExpense.findFirst.mockResolvedValue(null);

      await expect(
        service.remove('recurring-999', 'user-uuid-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('generateMonthlyExpenses', () => {
    it('deve usar valor do histórico vigente via createMany', async () => {
      const recurringWithHistory = {
        ...mockRecurring,
        history: [
          { id: 'hist-2', amount: 150, month: 3, year: 2026 },
          { id: 'hist-1', amount: 120, month: 1, year: 2026 },
        ],
      };
      mockPrisma.recurringExpense.findMany.mockResolvedValue([
        recurringWithHistory,
      ]);
      mockPrisma.expenseEntry.createMany.mockResolvedValue({ count: 11 });

      await service.generateMonthlyExpenses('user-uuid-1', 2, 2026);

      const call = mockPrisma.expenseEntry.createMany.mock.calls[0][0];
      // Fevereiro usa 120 (antes da mudança em março)
      expect(call.data[0].amount).toBe(120);
      // Abril usa 150 (depois da mudança em março)
      expect(call.data[2].amount).toBe(150);
    });

    it('não deve chamar createMany se todos já existem', async () => {
      mockPrisma.recurringExpense.findMany.mockResolvedValue([mockRecurring]);
      // Retornar entries existentes para todos os meses de abril a dezembro
      const existingEntries = [];
      for (let m = 4; m <= 12; m++) {
        existingEntries.push({
          recurringExpenseId: 'recurring-uuid-1',
          createdAt: new Date(Date.UTC(2026, m - 1, 10)),
        });
      }
      mockPrisma.expenseEntry.findMany.mockResolvedValue(existingEntries);

      const result = await service.generateMonthlyExpenses(
        'user-uuid-1',
        4,
        2026,
      );

      expect(result.generated).toBe(0);
      expect(mockPrisma.expenseEntry.createMany).not.toHaveBeenCalled();
    });

    it('deve gerar gastos apenas a partir do startDate até dezembro', async () => {
      const futureRecurring = {
        ...mockRecurring,
        startDate: new Date('2026-06-01'),
      };
      mockPrisma.recurringExpense.findMany.mockResolvedValue([futureRecurring]);
      mockPrisma.expenseEntry.create.mockResolvedValue({});

      const result = await service.generateMonthlyExpenses(
        'user-uuid-1',
        4,
        2026,
      );

      // startDate é junho, gera de junho a dezembro = 7 meses
      expect(result.generated).toBe(7);
    });

    it('deve retornar lista vazia sem recorrentes ativos', async () => {
      mockPrisma.recurringExpense.findMany.mockResolvedValue([]);

      const result = await service.generateMonthlyExpenses(
        'user-uuid-1',
        4,
        2026,
      );

      expect(result.generated).toBe(0);
      expect(result.entries).toHaveLength(0);
    });
  });
});
