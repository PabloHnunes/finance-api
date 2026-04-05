import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SalariesService } from './salaries.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  salary: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
  },
  salaryHistory: {
    update: jest.fn(),
    deleteMany: jest.fn(),
  },
};

const mockHistory = {
  id: 'history-uuid-1',
  amount: 3600,
  month: 4,
  year: 2026,
  salaryId: 'salary-uuid-1',
  createdAt: new Date(),
};

const mockSalary = {
  id: 'salary-uuid-1',
  name: 'Salário CLT',
  isMain: true,
  userId: 'user-uuid-1',
  history: [mockHistory],
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('SalariesService', () => {
  let service: SalariesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalariesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SalariesService>(SalariesService);
    jest.clearAllMocks();
    mockPrisma.salary.count.mockResolvedValue(0);
  });

  describe('create', () => {
    it('deve criar salário com histórico usando mês/ano informados', async () => {
      mockPrisma.salary.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.salary.create.mockResolvedValue(mockSalary);

      const result = await service.create('user-uuid-1', {
        name: 'Salário CLT',
        isMain: true,
        amount: 3600,
        month: 4,
        year: 2026,
      });

      expect(mockPrisma.salary.create).toHaveBeenCalledWith({
        data: {
          name: 'Salário CLT',
          isMain: true,
          userId: 'user-uuid-1',
          history: {
            create: { amount: 3600, month: 4, year: 2026 },
          },
        },
        include: { history: true },
      });
      expect(result).toEqual(mockSalary);
    });

    it('deve desativar renda principal anterior ao criar nova principal', async () => {
      mockPrisma.salary.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.salary.create.mockResolvedValue(mockSalary);

      await service.create('user-uuid-1', {
        name: 'Salário CLT',
        isMain: true,
        amount: 3600,
        month: 4,
        year: 2026,
      });

      expect(mockPrisma.salary.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-uuid-1', isMain: true },
        data: { isMain: false, isActive: false },
      });
    });

    it('não deve desativar nada ao criar salário não principal', async () => {
      mockPrisma.salary.create.mockResolvedValue(mockSalary);

      await service.create('user-uuid-1', {
        name: 'Freelance',
        amount: 2000,
      });

      expect(mockPrisma.salary.updateMany).not.toHaveBeenCalled();
    });

    it('deve usar mês/ano corrente quando não informados', async () => {
      mockPrisma.salary.create.mockResolvedValue(mockSalary);
      const now = new Date();

      await service.create('user-uuid-1', {
        name: 'Freelance',
        amount: 2000,
      });

      expect(mockPrisma.salary.create).toHaveBeenCalledWith({
        data: {
          name: 'Freelance',
          isMain: false,
          userId: 'user-uuid-1',
          history: {
            create: {
              amount: 2000,
              month: now.getMonth() + 1,
              year: now.getFullYear(),
            },
          },
        },
        include: { history: true },
      });
    });
  });

  describe('findAllByUser', () => {
    it('deve retornar salários do usuário com histórico ordenado', async () => {
      mockPrisma.salary.findMany.mockResolvedValue([mockSalary]);

      const result = await service.findAllByUser('user-uuid-1');

      expect(mockPrisma.salary.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-uuid-1', deletedAt: null },
        include: {
          history: { orderBy: [{ year: 'desc' }, { month: 'desc' }] },
        },
        take: undefined,
        skip: undefined,
      });
      expect(result.list).toHaveLength(1);
    });

    it('deve retornar lista vazia se usuário não tem salários', async () => {
      mockPrisma.salary.findMany.mockResolvedValue([]);

      const result = await service.findAllByUser('user-uuid-1');

      expect(result.list).toHaveLength(0);
    });

    it('deve filtrar por período retornando apenas receitas vigentes', async () => {
      mockPrisma.salary.findMany.mockResolvedValue([
        {
          ...mockSalary,
          isMain: true,
          history: [{ amount: 4100, month: 1, year: 2026 }],
        },
        {
          id: 'salary-uuid-2',
          name: 'Freelance',
          isMain: false,
          history: [{ amount: 2000, month: 3, year: 2026 }],
        },
      ]);

      const result = await service.findAllByUser(
        'user-uuid-1',
        undefined,
        undefined,
        3,
        2026,
      );

      expect(result.list).toHaveLength(2);
      expect(result.list[0].activeAmount).toBe(4100);
      expect(result.list[1].activeAmount).toBe(2000);
    });

    it('deve excluir renda extra fora do mês filtrado', async () => {
      mockPrisma.salary.findMany.mockResolvedValue([
        {
          ...mockSalary,
          isMain: true,
          history: [{ amount: 4100, month: 1, year: 2026 }],
        },
        {
          id: 'salary-uuid-2',
          name: 'Freelance',
          isMain: false,
          history: [{ amount: 2000, month: 1, year: 2026 }],
        },
      ]);

      const result = await service.findAllByUser(
        'user-uuid-1',
        undefined,
        undefined,
        3,
        2026,
      );

      expect(result.list).toHaveLength(1);
      expect(result.list[0].name).toBe('Salário CLT');
    });
  });

  describe('findOne', () => {
    it('deve retornar salário com histórico', async () => {
      mockPrisma.salary.findFirst.mockResolvedValue(mockSalary);

      const result = await service.findOne('salary-uuid-1', 'user-uuid-1');

      expect(result).toEqual(mockSalary);
    });

    it('deve lançar NotFoundException se salário não existe', async () => {
      mockPrisma.salary.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne('salary-999', 'user-uuid-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('deve atualizar apenas o nome do salário', async () => {
      mockPrisma.salary.findFirst.mockResolvedValue(mockSalary);
      const updated = { ...mockSalary, name: 'Salário PJ' };
      mockPrisma.salary.update.mockResolvedValue(updated);

      const result = await service.update('salary-uuid-1', 'user-uuid-1', {
        name: 'Salário PJ',
      });

      expect(mockPrisma.salary.update).toHaveBeenCalledWith({
        where: { id: 'salary-uuid-1' },
        data: { name: 'Salário PJ' },
        include: {
          history: { orderBy: [{ year: 'desc' }, { month: 'desc' }] },
        },
      });
      expect(result.name).toBe('Salário PJ');
    });

    it('deve desativar principal anterior ao promover salário para isMain', async () => {
      mockPrisma.salary.findFirst.mockResolvedValue({
        ...mockSalary,
        isMain: false,
      });
      mockPrisma.salary.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.salary.update.mockResolvedValue({
        ...mockSalary,
        isMain: true,
        isActive: true,
      });

      await service.update('salary-uuid-1', 'user-uuid-1', {
        isMain: true,
      });

      expect(mockPrisma.salary.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-uuid-1', isMain: true },
        data: { isMain: false, isActive: false },
      });
      expect(mockPrisma.salary.update).toHaveBeenCalledWith({
        where: { id: 'salary-uuid-1' },
        data: { isMain: true, isActive: true },
        include: {
          history: { orderBy: [{ year: 'desc' }, { month: 'desc' }] },
        },
      });
    });

    it('deve atualizar isMain para false sem desativar outros', async () => {
      mockPrisma.salary.findFirst.mockResolvedValue(mockSalary);
      mockPrisma.salary.update.mockResolvedValue({
        ...mockSalary,
        isMain: false,
      });

      await service.update('salary-uuid-1', 'user-uuid-1', {
        isMain: false,
      });

      expect(mockPrisma.salary.updateMany).not.toHaveBeenCalled();
      expect(mockPrisma.salary.update).toHaveBeenCalledWith({
        where: { id: 'salary-uuid-1' },
        data: { isMain: false },
        include: {
          history: { orderBy: [{ year: 'desc' }, { month: 'desc' }] },
        },
      });
    });

    it('deve atualizar o valor no histórico mais recente', async () => {
      mockPrisma.salary.findFirst.mockResolvedValue(mockSalary);
      mockPrisma.salaryHistory.update.mockResolvedValue({
        ...mockHistory,
        amount: 4100,
      });

      await service.update('salary-uuid-1', 'user-uuid-1', {
        amount: 4100,
      });

      expect(mockPrisma.salaryHistory.update).toHaveBeenCalledWith({
        where: { id: 'history-uuid-1' },
        data: { amount: 4100, month: 4, year: 2026 },
      });
    });

    it('deve atualizar mês/ano do histórico quando há apenas um registro', async () => {
      mockPrisma.salary.findFirst.mockResolvedValue(mockSalary);
      mockPrisma.salaryHistory.update.mockResolvedValue({
        ...mockHistory,
        month: 6,
        year: 2026,
      });

      await service.update('salary-uuid-1', 'user-uuid-1', {
        month: 6,
        year: 2026,
      });

      expect(mockPrisma.salaryHistory.update).toHaveBeenCalledWith({
        where: { id: 'history-uuid-1' },
        data: { amount: 3600, month: 6, year: 2026 },
      });
    });

    it('deve lançar BadRequestException ao definir data anterior a outro registro do histórico', async () => {
      const olderHistory = {
        id: 'history-uuid-2',
        amount: 3000,
        month: 3,
        year: 2026,
        salaryId: 'salary-uuid-1',
        createdAt: new Date(),
      };

      const salaryWithMultipleHistory = {
        ...mockSalary,
        history: [mockHistory, olderHistory],
      };

      mockPrisma.salary.findFirst.mockResolvedValue(salaryWithMultipleHistory);

      await expect(
        service.update('salary-uuid-1', 'user-uuid-1', {
          month: 2,
          year: 2026,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve lançar BadRequestException se não há histórico para atualizar', async () => {
      const salaryNoHistory = { ...mockSalary, history: [] };
      mockPrisma.salary.findFirst.mockResolvedValue(salaryNoHistory);

      await expect(
        service.update('salary-uuid-1', 'user-uuid-1', { amount: 5000 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('deve lançar NotFoundException ao atualizar salário inexistente', async () => {
      mockPrisma.salary.findFirst.mockResolvedValue(null);

      await expect(
        service.update('salary-999', 'user-uuid-1', { name: 'Novo' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deve fazer soft delete do salário', async () => {
      mockPrisma.salary.findFirst.mockResolvedValue(mockSalary);
      mockPrisma.salary.update.mockResolvedValue({
        ...mockSalary,
        deletedAt: new Date(),
        isActive: false,
      });

      await service.remove('salary-uuid-1', 'user-uuid-1');

      expect(mockPrisma.salary.update).toHaveBeenCalledWith({
        where: { id: 'salary-uuid-1' },
        data: { deletedAt: expect.any(Date), isActive: false },
      });
    });

    it('deve lançar NotFoundException ao deletar salário inexistente', async () => {
      mockPrisma.salary.findFirst.mockResolvedValue(null);

      await expect(service.remove('salary-999', 'user-uuid-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
