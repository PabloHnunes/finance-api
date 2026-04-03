import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/crypto.service';
import { CreateBankDto } from './dto/create-bank.dto';
import { UpdateBankDto } from './dto/update-bank.dto';

@Injectable()
export class BanksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  create(userId: string, dto: CreateBankDto) {
    return this.prisma.bank.create({
      data: {
        ...dto,
        documentNumber: this.crypto.encrypt(dto.documentNumber),
        userId,
      },
    });
  }

  async findAllByUser(userId: string) {
    const banks = await this.prisma.bank.findMany({
      where: { userId },
    });
    return banks.map((b) => ({
      ...b,
      documentNumber: this.maskDocument(this.crypto.decrypt(b.documentNumber)),
    }));
  }

  async findOne(id: string, userId: string) {
    const bank = await this.prisma.bank.findFirst({
      where: { id, userId },
    });
    if (!bank) throw new NotFoundException('Bank not found');
    return {
      ...bank,
      documentNumber: this.maskDocument(this.crypto.decrypt(bank.documentNumber)),
    };
  }

  async update(id: string, userId: string, dto: UpdateBankDto) {
    await this.findOne(id, userId);
    const data = {
      ...dto,
      documentNumber: dto.documentNumber
        ? this.crypto.encrypt(dto.documentNumber)
        : undefined,
    };
    return this.prisma.bank.update({
      where: { id },
      data,
    });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.bank.delete({ where: { id } });
  }

  private maskDocument(doc: string): string {
    if (doc.length <= 4) return '****';
    return '*'.repeat(doc.length - 4) + doc.slice(-4);
  }
}
