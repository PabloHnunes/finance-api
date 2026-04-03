import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/crypto.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async create(dto: CreateUserDto) {
    const { password, cpf, ...userData } = dto;

    const encryptedCpf = this.crypto.encrypt(cpf);

    const existingUsers = await this.prisma.user.findMany({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
    });

    const cpfConflict = existingUsers.some(
      (u) => this.crypto.decrypt(u.cpf) === cpf,
    );
    if (
      existingUsers.some(
        (u) => u.email === dto.email || u.username === dto.username,
      ) ||
      cpfConflict
    ) {
      throw new ConflictException(
        'Email, username or CPF already registered',
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await this.prisma.user.create({
      data: {
        ...userData,
        cpf: encryptedCpf,
        birthDate: new Date(userData.birthDate),
        authProviders: {
          create: {
            provider: 'LOCAL',
            passwordHash,
          },
        },
      },
      select: this.safeSelect(),
    });

    return { ...user, cpf: this.maskCpf(cpf) };
  }

  async findAll() {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null },
      select: this.safeSelect(),
    });
    return users.map((u) => ({
      ...u,
      cpf: this.maskCpf(this.crypto.decrypt(u.cpf)),
    }));
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: this.safeSelect(),
    });
    if (!user) throw new NotFoundException('User not found');
    return {
      ...user,
      cpf: this.maskCpf(this.crypto.decrypt(user.cpf)),
    };
  }

  async findByEmail(email: string) {
    return this.prisma.user.findFirst({
      where: { email, deletedAt: null },
      include: { authProviders: true },
    });
  }

  async findByUsername(username: string) {
    return this.prisma.user.findFirst({
      where: { username, deletedAt: null },
      include: { authProviders: true },
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...dto,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
      },
      select: this.safeSelect(),
    });
    return {
      ...user,
      cpf: this.maskCpf(this.crypto.decrypt(user.cpf)),
    };
  }

  async remove(id: string) {
    await this.findOne(id);
    const user = await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
      select: this.safeSelect(),
    });
    return {
      ...user,
      cpf: this.maskCpf(this.crypto.decrypt(user.cpf)),
    };
  }

  private maskCpf(cpf: string): string {
    return `***.***.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
  }

  private safeSelect() {
    return {
      id: true,
      email: true,
      username: true,
      firstName: true,
      lastName: true,
      cpf: true,
      birthDate: true,
      street: true,
      neighborhood: true,
      state: true,
      city: true,
      number: true,
      zipCode: true,
      createdAt: true,
      updatedAt: true,
    } as const;
  }
}
