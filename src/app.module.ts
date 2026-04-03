import { Module } from '@nestjs/common';
import { CommonModule } from './common/common.module';
import { PrismaModule } from './prisma/prisma.module';
import { BanksModule } from './banks/banks.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [CommonModule, PrismaModule, BanksModule, UsersModule, AuthModule],
})
export class AppModule {}
