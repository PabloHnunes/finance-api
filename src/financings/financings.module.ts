import { Module } from '@nestjs/common';
import { FinancingsController } from './financings.controller';
import { FinancingsService } from './financings.service';

@Module({
  controllers: [FinancingsController],
  providers: [FinancingsService],
  exports: [FinancingsService],
})
export class FinancingsModule {}
