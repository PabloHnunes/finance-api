import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { BanksService } from './banks.service';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/crypto.service';

const mockPrisma = {
  bank: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

const mockCrypto = {
  encrypt: jest.fn((val: string) => `encrypted:${val}`),
  decrypt: jest.fn((val: string) => val.replace('encrypted:', '')),
};

const mockBank = {
  id: 'bank-uuid-1',
  name: 'Nubank',
  description: 'Conta corrente',
  documentType: 'PF',
  documentNumber: 'encrypted:12345678901',
  userId: 'user-uuid-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('BanksService', () => {
  let service: BanksService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BanksService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CryptoService, useValue: mockCrypto },
      ],
    }).compile();

    service = module.get<BanksService>(BanksService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('deve criar um banco com documento criptografado', async () => {
      mockPrisma.bank.create.mockResolvedValue(mockBank);

      const result = await service.create('user-uuid-1', {
        name: 'Nubank',
        description: 'Conta corrente',
        documentType: 'PF',
        documentNumber: '12345678901',
      });

      expect(mockCrypto.encrypt).toHaveBeenCalledWith('12345678901');
      expect(mockPrisma.bank.create).toHaveBeenCalledWith({
        data: {
          name: 'Nubank',
          description: 'Conta corrente',
          documentType: 'PF',
          documentNumber: 'encrypted:12345678901',
          userId: 'user-uuid-1',
        },
      });
      expect(result).toEqual(mockBank);
    });
  });

  describe('findAllByUser', () => {
    it('deve retornar bancos do usuário com documento mascarado', async () => {
      mockPrisma.bank.findMany.mockResolvedValue([mockBank]);
      mockCrypto.decrypt.mockReturnValue('12345678901');

      const result = await service.findAllByUser('user-uuid-1');

      expect(result).toHaveLength(1);
      expect(result[0].documentNumber).toBe('*******8901');
    });

    it('deve retornar lista vazia se usuário não tem bancos', async () => {
      mockPrisma.bank.findMany.mockResolvedValue([]);

      const result = await service.findAllByUser('user-uuid-1');

      expect(result).toHaveLength(0);
    });
  });

  describe('findOne', () => {
    it('deve retornar banco com documento mascarado', async () => {
      mockPrisma.bank.findFirst.mockResolvedValue(mockBank);
      mockCrypto.decrypt.mockReturnValue('12345678901');

      const result = await service.findOne('bank-uuid-1', 'user-uuid-1');

      expect(result.name).toBe('Nubank');
      expect(result.documentNumber).toBe('*******8901');
    });

    it('deve lançar NotFoundException se banco não existe', async () => {
      mockPrisma.bank.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne('bank-999', 'user-uuid-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('deve atualizar banco com sucesso', async () => {
      mockPrisma.bank.findFirst.mockResolvedValue(mockBank);
      mockCrypto.decrypt.mockReturnValue('12345678901');

      const updatedBank = { ...mockBank, name: 'Itaú' };
      mockPrisma.bank.update.mockResolvedValue(updatedBank);

      const result = await service.update('bank-uuid-1', 'user-uuid-1', {
        name: 'Itaú',
      });

      expect(result.name).toBe('Itaú');
    });

    it('deve criptografar novo documentNumber ao atualizar', async () => {
      mockPrisma.bank.findFirst.mockResolvedValue(mockBank);
      mockCrypto.decrypt.mockReturnValue('12345678901');
      mockPrisma.bank.update.mockResolvedValue(mockBank);

      await service.update('bank-uuid-1', 'user-uuid-1', {
        documentNumber: '99999999999',
      });

      expect(mockCrypto.encrypt).toHaveBeenCalledWith('99999999999');
    });

    it('deve lançar NotFoundException ao atualizar banco inexistente', async () => {
      mockPrisma.bank.findFirst.mockResolvedValue(null);

      await expect(
        service.update('bank-999', 'user-uuid-1', { name: 'Itaú' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deve deletar banco com sucesso', async () => {
      mockPrisma.bank.findFirst.mockResolvedValue(mockBank);
      mockCrypto.decrypt.mockReturnValue('12345678901');
      mockPrisma.bank.delete.mockResolvedValue(mockBank);

      const result = await service.remove('bank-uuid-1', 'user-uuid-1');

      expect(mockPrisma.bank.delete).toHaveBeenCalledWith({
        where: { id: 'bank-uuid-1' },
      });
      expect(result).toEqual(mockBank);
    });

    it('deve lançar NotFoundException ao deletar banco inexistente', async () => {
      mockPrisma.bank.findFirst.mockResolvedValue(null);

      await expect(
        service.remove('bank-999', 'user-uuid-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
