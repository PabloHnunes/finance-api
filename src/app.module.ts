import { Module } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { CommonModule } from './common/common.module';
import { PrismaModule } from './prisma/prisma.module';
import { BanksModule } from './banks/banks.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { SalariesModule } from './salaries/salaries.module';
import { ExpenseEntriesModule } from './expense-entries/expense-entries.module';
import { BalanceModule } from './balance/balance.module';
import { FinancingsModule } from './financings/financings.module';
import { RecurringExpensesModule } from './recurring-expenses/recurring-expenses.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 3 },
      { name: 'medium', ttl: 10000, limit: 20 },
      { name: 'long', ttl: 60000, limit: 100 },
    ]),
    CommonModule,
    PrismaModule,
    BanksModule,
    UsersModule,
    AuthModule,
    SalariesModule,
    ExpenseEntriesModule,
    BalanceModule,
    FinancingsModule,
    RecurringExpensesModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
