import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/crypto.service';
import { CreateUserDto } from './dto/create-user.dto';

const mockPrisma = {
  user: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

const mockCrypto = {
  encrypt: jest.fn((val: string) => `encrypted:${val}`),
  decrypt: jest.fn((val: string) => val.replace('encrypted:', '')),
};

const createUserDto: CreateUserDto = {
  email: 'pablo@email.com',
  username: 'pablohnunes',
  firstName: 'Pablo',
  lastName: 'Nunes',
  cpf: '12345678901',
  birthDate: '1995-03-20',
  street: 'Rua Exemplo',
  neighborhood: 'Centro',
  state: 'SP',
  city: 'São Paulo',
  number: '100',
  zipCode: '01001000',
  password: 'SenhaForte123!',
};

const mockUser = {
  id: 'uuid-123',
  email: 'pablo@email.com',
  username: 'pablohnunes',
  firstName: 'Pablo',
  lastName: 'Nunes',
  cpf: 'encrypted:12345678901',
  birthDate: new Date('1995-03-20'),
  street: 'Rua Exemplo',
  neighborhood: 'Centro',
  state: 'SP',
  city: 'São Paulo',
  number: '100',
  zipCode: '01001000',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CryptoService, useValue: mockCrypto },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('deve criar um usuário com sucesso', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.create.mockResolvedValue(mockUser);

      const result = await service.create(createUserDto);

      expect(result.email).toBe('pablo@email.com');
      expect(result.cpf).toBe('***.***.789-01');
      expect(mockCrypto.encrypt).toHaveBeenCalledWith('12345678901');
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'pablo@email.com',
            cpf: 'encrypted:12345678901',
          }),
        }),
      );
    });

    it('deve lançar ConflictException se email já existe', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { email: 'pablo@email.com', cpf: 'encrypted:99999999999' },
      ]);

      await expect(service.create(createUserDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('deve lançar ConflictException se username já existe', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        {
          email: 'outro@email.com',
          username: 'pablohnunes',
          cpf: 'encrypted:99999999999',
        },
      ]);

      await expect(service.create(createUserDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('deve lançar ConflictException se CPF já existe', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { email: 'outro@email.com', cpf: 'encrypted:12345678901' },
      ]);
      mockCrypto.decrypt.mockReturnValue('12345678901');

      await expect(service.create(createUserDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('deve hashear a senha com bcrypt', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.create.mockResolvedValue(mockUser);

      await service.create(createUserDto);

      const createCall = mockPrisma.user.create.mock.calls[0][0] as {
        data: { authProviders: { create: { passwordHash: string } } };
      };
      const passwordHash = createCall.data.authProviders.create.passwordHash;

      const isValid = await bcrypt.compare('SenhaForte123!', passwordHash);
      expect(isValid).toBe(true);
    });
  });

  describe('findAll', () => {
    it('deve retornar lista de usuários com CPF mascarado', async () => {
      mockPrisma.user.findMany.mockResolvedValue([mockUser]);
      mockCrypto.decrypt.mockReturnValue('12345678901');

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(result[0].cpf).toBe('***.***.789-01');
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deletedAt: null },
        }),
      );
    });

    it('deve retornar lista vazia quando não há usuários', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await service.findAll();

      expect(result).toHaveLength(0);
    });
  });

  describe('findOne', () => {
    it('deve retornar usuário pelo ID', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockCrypto.decrypt.mockReturnValue('12345678901');

      const result = await service.findOne('uuid-123');

      expect(result.email).toBe('pablo@email.com');
      expect(result.cpf).toBe('***.***.789-01');
    });

    it('deve lançar NotFoundException se usuário não existe', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(service.findOne('uuid-999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByEmail', () => {
    it('deve buscar usuário pelo email incluindo authProviders', async () => {
      const userWithProviders = {
        ...mockUser,
        authProviders: [{ provider: 'LOCAL', passwordHash: 'hash' }],
      };
      mockPrisma.user.findFirst.mockResolvedValue(userWithProviders);

      const result = await service.findByEmail('pablo@email.com');

      expect(result).toEqual(userWithProviders);
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { email: 'pablo@email.com', deletedAt: null },
        include: { authProviders: true },
      });
    });
  });

  describe('findByUsername', () => {
    it('deve buscar usuário pelo username incluindo authProviders', async () => {
      const userWithProviders = {
        ...mockUser,
        authProviders: [{ provider: 'LOCAL', passwordHash: 'hash' }],
      };
      mockPrisma.user.findFirst.mockResolvedValue(userWithProviders);

      const result = await service.findByUsername('pablohnunes');

      expect(result).toEqual(userWithProviders);
      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { username: 'pablohnunes', deletedAt: null },
        include: { authProviders: true },
      });
    });
  });

  describe('update', () => {
    it('deve atualizar o usuário com sucesso', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockCrypto.decrypt.mockReturnValue('12345678901');

      const updatedUser = { ...mockUser, firstName: 'Pablo Henrique' };
      mockPrisma.user.update.mockResolvedValue(updatedUser);

      const result = await service.update('uuid-123', {
        firstName: 'Pablo Henrique',
      });

      expect(result.firstName).toBe('Pablo Henrique');
    });

    it('deve lançar NotFoundException ao atualizar usuário inexistente', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.update('uuid-999', { firstName: 'Teste' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deve fazer soft delete do usuário', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockCrypto.decrypt.mockReturnValue('12345678901');

      const deletedUser = { ...mockUser, deletedAt: new Date() };
      mockPrisma.user.update.mockResolvedValue(deletedUser);

      const result = await service.remove('uuid-123');

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { deletedAt: expect.any(Date) },
        }),
      );
      expect(result.cpf).toBe('***.***.789-01');
    });

    it('deve lançar NotFoundException ao remover usuário inexistente', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(service.remove('uuid-999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
