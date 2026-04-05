import {
  Controller,
  Get,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { BalanceService } from './balance.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OwnershipGuard } from '../auth/guards/ownership.guard';
import { ParseMonthPipe } from '../common/pipes/parse-month.pipe';
import { ParseYearPipe } from '../common/pipes/parse-year.pipe';

@ApiTags('Balance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OwnershipGuard)
@Controller('balance')
export class BalanceController {
  constructor(private readonly balanceService: BalanceService) {}

  @Get('user/:userId')
  @ApiOperation({ summary: 'Balanço de salário vs gastos do período' })
  @ApiQuery({ name: 'month', required: false, example: 4 })
  @ApiQuery({ name: 'year', required: false, example: 2026 })
  getBalance(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('month', ParseMonthPipe) month?: number,
    @Query('year', ParseYearPipe) year?: number,
  ) {
    const now = new Date();
    const m = month ?? now.getMonth() + 1;
    const y = year ?? now.getFullYear();

    return this.balanceService.getBalance(userId, m, y);
  }
}
