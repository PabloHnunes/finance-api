import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

const mockUsersService = {
  findByEmail: jest.fn(),
  findByUsername: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock-token'),
  verify: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('deve retornar tokens ao logar com credenciais válidas', async () => {
      const passwordHash = await bcrypt.hash('SenhaForte123!', 12);
      mockUsersService.findByEmail.mockResolvedValue({
        id: 'uuid-123',
        email: 'pablo@email.com',
        authProviders: [{ provider: 'LOCAL', passwordHash }],
      });

      const result = await service.login({
        email: 'pablo@email.com',
        password: 'SenhaForte123!',
      });

      expect(result).toEqual({
        accessToken: 'mock-token',
        refreshToken: 'mock-token',
      });
      expect(mockJwtService.sign).toHaveBeenCalledTimes(2);
    });

    it('deve lançar UnauthorizedException se usuário não existe', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'naoexiste@email.com', password: '12345678' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('deve lançar UnauthorizedException se não tem provider LOCAL', async () => {
      mockUsersService.findByEmail.mockResolvedValue({
        id: 'uuid-123',
        email: 'pablo@email.com',
        authProviders: [{ provider: 'GOOGLE', providerId: 'google-id' }],
      });

      await expect(
        service.login({ email: 'pablo@email.com', password: 'SenhaForte123!' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('deve retornar tokens ao logar com username', async () => {
      const passwordHash = await bcrypt.hash('SenhaForte123!', 12);
      mockUsersService.findByUsername.mockResolvedValue({
        id: 'uuid-123',
        email: 'pablo@email.com',
        authProviders: [{ provider: 'LOCAL', passwordHash }],
      });

      const result = await service.login({
        username: 'pablohnunes',
        password: 'SenhaForte123!',
      });

      expect(result).toEqual({
        accessToken: 'mock-token',
        refreshToken: 'mock-token',
      });
      expect(mockUsersService.findByUsername).toHaveBeenCalledWith('pablohnunes');
      expect(mockUsersService.findByEmail).not.toHaveBeenCalled();
    });

    it('deve lançar UnauthorizedException se senha está incorreta', async () => {
      const passwordHash = await bcrypt.hash('SenhaForte123!', 12);
      mockUsersService.findByEmail.mockResolvedValue({
        id: 'uuid-123',
        email: 'pablo@email.com',
        authProviders: [{ provider: 'LOCAL', passwordHash }],
      });

      await expect(
        service.login({ email: 'pablo@email.com', password: 'SenhaErrada!' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshToken', () => {
    it('deve gerar novos tokens com refresh token válido', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'uuid-123',
        email: 'pablo@email.com',
      });

      const result = await service.refreshToken('valid-refresh-token');

      expect(result).toEqual({
        accessToken: 'mock-token',
        refreshToken: 'mock-token',
      });
    });

    it('deve lançar UnauthorizedException com refresh token inválido', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      await expect(service.refreshToken('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
