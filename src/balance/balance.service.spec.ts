import { Test, TestingModule } from '@nestjs/testing';
import { BalanceService } from './balance.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  salary: {
    findMany: jest.fn(),
  },
  expenseEntry: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
  recurringExpense: {
    findMany: jest.fn(),
  },
};

describe('BalanceService', () => {
  let service: BalanceService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BalanceService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<BalanceService>(BalanceService);
    jest.clearAllMocks();
    mockPrisma.recurringExpense.findMany.mockResolvedValue([]);
    mockPrisma.expenseEntry.findFirst.mockResolvedValue(null);
  });

  describe('getBalance', () => {
    it('deve retornar balanço com salário e gastos do período', async () => {
      mockPrisma.salary.findMany.mockResolvedValue([
        {
          name: 'Salário CLT',
          isMain: true,
          history: [
            { amount: 4100, month: 1, year: 2026 },
            { amount: 3600, month: 1, year: 2025 },
          ],
        },
      ]);

      mockPrisma.expenseEntry.findMany.mockResolvedValue([
        {
          amount: 800,
          expenseCategory: 'GROCERIES',
          paymentType: 'PIX',
          splitParts: 1,
          userPart: 1,
        },
        {
          amount: 500,
          expenseCategory: 'LEISURE',
          paymentType: 'CREDIT',
          splitParts: 1,
          userPart: 1,
        },
        {
          amount: 350,
          expenseCategory: 'GROCERIES',
          paymentType: 'PIX',
          splitParts: 1,
          userPart: 1,
        },
      ]);

      const result = await service.getBalance('user-uuid-1', 4, 2026);

      expect(result.period).toEqual({ month: 4, year: 2026 });
      expect(result.totalSalary).toBe(4100);
      expect(result.totalExpenses).toBe(1650);
      expect(result.balance).toBe(2450);
      expect(result.expensesByCategory).toEqual({
        GROCERIES: 1150,
        LEISURE: 500,
      });
      expect(result.expensesByPaymentType).toEqual({
        PIX: 1150,
        CREDIT: 500,
      });
    });

    it('deve retornar balanço zerado sem salários e gastos', async () => {
      mockPrisma.salary.findMany.mockResolvedValue([]);
      mockPrisma.expenseEntry.findMany.mockResolvedValue([]);

      const result = await service.getBalance('user-uuid-1', 4, 2026);

      expect(result.totalSalary).toBe(0);
      expect(result.totalExpenses).toBe(0);
      expect(result.balance).toBe(0);
      expect(result.expensesByCategory).toEqual({});
      expect(result.expensesByPaymentType).toEqual({});
    });

    it('deve usar o salário vigente no período consultado', async () => {
      mockPrisma.salary.findMany.mockResolvedValue([
        {
          name: 'Salário CLT',
          isMain: true,
          history: [
            { amount: 5000, month: 6, year: 2026 },
            { amount: 4100, month: 1, year: 2026 },
            { amount: 3600, month: 1, year: 2025 },
          ],
        },
      ]);
      mockPrisma.expenseEntry.findMany.mockResolvedValue([]);

      const result = await service.getBalance('user-uuid-1', 3, 2026);

      expect(result.totalSalary).toBe(4100);
    });

    it('deve somar múltiplos salários ativos no mesmo mês', async () => {
      mockPrisma.salary.findMany.mockResolvedValue([
        {
          name: 'Salário CLT',
          isMain: true,
          history: [{ amount: 4100, month: 1, year: 2026 }],
        },
        {
          name: 'Freelance',
          isMain: false,
          history: [{ amount: 2000, month: 3, year: 2026 }],
        },
      ]);
      mockPrisma.expenseEntry.findMany.mockResolvedValue([]);

      const result = await service.getBalance('user-uuid-1', 3, 2026);

      expect(result.totalSalary).toBe(6100);
    });

    it('não deve incluir renda extra de outro mês no balanço', async () => {
      mockPrisma.salary.findMany.mockResolvedValue([
        {
          name: 'Salário CLT',
          isMain: true,
          history: [{ amount: 4100, month: 1, year: 2026 }],
        },
        {
          name: 'Freelance',
          isMain: false,
          history: [{ amount: 2000, month: 1, year: 2026 }],
        },
      ]);
      mockPrisma.expenseEntry.findMany.mockResolvedValue([]);

      const result = await service.getBalance('user-uuid-1', 2, 2026);

      expect(result.totalSalary).toBe(4100);
    });

    it('deve ignorar salário sem histórico válido para o período', async () => {
      mockPrisma.salary.findMany.mockResolvedValue([
        {
          name: 'Emprego Novo',
          isMain: true,
          history: [{ amount: 8000, month: 6, year: 2026 }],
        },
      ]);
      mockPrisma.expenseEntry.findMany.mockResolvedValue([]);

      const result = await service.getBalance('user-uuid-1', 4, 2026);

      expect(result.totalSalary).toBe(0);
    });

    it('deve filtrar gastos pelo mês/ano correto', async () => {
      mockPrisma.salary.findMany.mockResolvedValue([]);
      mockPrisma.expenseEntry.findMany.mockResolvedValue([]);

      await service.getBalance('user-uuid-1', 4, 2026);

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
      });
    });

    it('deve retornar balanço negativo quando gastos superam salário', async () => {
      mockPrisma.salary.findMany.mockResolvedValue([
        {
          name: 'Salário CLT',
          isMain: true,
          history: [{ amount: 3000, month: 1, year: 2026 }],
        },
      ]);
      mockPrisma.expenseEntry.findMany.mockResolvedValue([
        {
          amount: 2000,
          expenseCategory: 'FINANCING_PROPERTY',
          paymentType: 'TRANSFER',
          splitParts: 1,
          userPart: 1,
        },
        {
          amount: 1500,
          expenseCategory: 'GROCERIES',
          paymentType: 'PIX',
          splitParts: 1,
          userPart: 1,
        },
      ]);

      const result = await service.getBalance('user-uuid-1', 4, 2026);

      expect(result.balance).toBe(-500);
    });

    it('deve incluir recorrentes não gerados no balanço', async () => {
      mockPrisma.salary.findMany.mockResolvedValue([
        {
          name: 'Salário CLT',
          isMain: true,
          history: [{ amount: 4000, month: 1, year: 2026 }],
        },
      ]);
      mockPrisma.expenseEntry.findMany.mockResolvedValue([]);
      mockPrisma.recurringExpense.findMany.mockResolvedValue([
        {
          id: 'rec-1',
          amount: 120,
          expenseCategory: 'UTILITIES',
          paymentType: 'BOLETO',
          splitParts: 1,
          userPart: 1,
          startDate: new Date('2026-01-01'),
        },
        {
          id: 'rec-2',
          amount: 200,
          expenseCategory: 'UTILITIES',
          paymentType: 'PIX',
          splitParts: 2,
          userPart: 1,
          startDate: new Date('2026-01-01'),
        },
      ]);
      mockPrisma.expenseEntry.findFirst.mockResolvedValue(null);

      const result = await service.getBalance('user-uuid-1', 4, 2026);

      expect(result.totalExpenses).toBe(220);
      expect(result.balance).toBe(3780);
      expect(result.expensesByCategory).toEqual({ UTILITIES: 220 });
    });

    it('não deve duplicar recorrente já gerado no mês', async () => {
      mockPrisma.salary.findMany.mockResolvedValue([]);
      // getExpenses retorna o entry gerado
      mockPrisma.expenseEntry.findMany
        .mockResolvedValueOnce([
          {
            amount: 120,
            expenseCategory: 'UTILITIES',
            paymentType: 'BOLETO',
            splitParts: 1,
            userPart: 1,
          },
        ])
        // getRecurringNotGenerated retorna o ID do recorrente já gerado
        .mockResolvedValueOnce([{ recurringExpenseId: 'rec-1' }]);
      mockPrisma.recurringExpense.findMany.mockResolvedValue([
        {
          id: 'rec-1',
          amount: 120,
          expenseCategory: 'UTILITIES',
          paymentType: 'BOLETO',
          splitParts: 1,
          userPart: 1,
          startDate: new Date('2026-01-01'),
        },
      ]);

      const result = await service.getBalance('user-uuid-1', 4, 2026);

      expect(result.totalExpenses).toBe(120);
    });

    it('deve considerar split no cálculo do balanço', async () => {
      mockPrisma.salary.findMany.mockResolvedValue([
        {
          name: 'Salário CLT',
          isMain: true,
          history: [{ amount: 4000, month: 1, year: 2026 }],
        },
      ]);
      mockPrisma.expenseEntry.findMany.mockResolvedValue([
        {
          amount: 200,
          expenseCategory: 'UTILITIES',
          paymentType: 'PIX',
          splitParts: 2,
          userPart: 1,
        },
        {
          amount: 500,
          expenseCategory: 'GROCERIES',
          paymentType: 'PIX',
          splitParts: 1,
          userPart: 1,
        },
      ]);

      const result = await service.getBalance('user-uuid-1', 4, 2026);

      expect(result.totalExpenses).toBe(600);
      expect(result.balance).toBe(3400);
      expect(result.expensesByCategory).toEqual({
        UTILITIES: 100,
        GROCERIES: 500,
      });
    });
  });
});
