import { Module } from '@nestjs/common';
import { ExpenseEntriesController } from './expense-entries.controller';
import { ExpenseEntriesService } from './expense-entries.service';
import { RecurringExpensesModule } from '../recurring-expenses/recurring-expenses.module';
import { FinancingsModule } from '../financings/financings.module';

@Module({
  imports: [RecurringExpensesModule, FinancingsModule],
  controllers: [ExpenseEntriesController],
  providers: [ExpenseEntriesService],
})
export class ExpenseEntriesModule {}
