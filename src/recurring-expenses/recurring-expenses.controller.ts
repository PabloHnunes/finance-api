import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
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
import { RecurringExpensesService } from './recurring-expenses.service';
import { CreateRecurringExpenseDto } from './dto/create-recurring-expense.dto';
import { UpdateRecurringExpenseDto } from './dto/update-recurring-expense.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OwnershipGuard } from '../auth/guards/ownership.guard';
import { ParseMonthPipe } from '../common/pipes/parse-month.pipe';
import { ParseYearPipe } from '../common/pipes/parse-year.pipe';

@ApiTags('Recurring Expenses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OwnershipGuard)
@Controller('recurring-expenses')
export class RecurringExpensesController {
  constructor(
    private readonly recurringExpensesService: RecurringExpensesService,
  ) {}

  @Post(':userId')
  @ApiOperation({ summary: 'Criar gasto recorrente' })
  create(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: CreateRecurringExpenseDto,
  ) {
    return this.recurringExpensesService.create(userId, dto);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Listar gastos recorrentes do usuário' })
  findAll(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.recurringExpensesService.findAllByUser(
      userId,
      pagination.limit,
      pagination.offset,
    );
  }

  @Get(':id/user/:userId')
  @ApiOperation({ summary: 'Buscar gasto recorrente por ID' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.recurringExpensesService.findOne(id, userId);
  }

  @Put(':id/user/:userId')
  @ApiOperation({ summary: 'Atualizar gasto recorrente' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateRecurringExpenseDto,
  ) {
    return this.recurringExpensesService.update(id, userId, dto);
  }

  @Delete(':id/user/:userId')
  @ApiOperation({ summary: 'Remover gasto recorrente' })
  @ApiQuery({ name: 'month', required: false, example: 3 })
  @ApiQuery({ name: 'year', required: false, example: 2026 })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('month', ParseMonthPipe) month?: number,
    @Query('year', ParseYearPipe) year?: number,
  ) {
    return this.recurringExpensesService.remove(id, userId, month, year);
  }

  @Post('generate/:userId')
  @ApiOperation({ summary: 'Gerar gastos do mês a partir dos recorrentes' })
  @ApiQuery({ name: 'month', required: false, example: 4 })
  @ApiQuery({ name: 'year', required: false, example: 2026 })
  generate(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('month', ParseMonthPipe) month?: number,
    @Query('year', ParseYearPipe) year?: number,
  ) {
    const now = new Date();
    const m = month ?? now.getMonth() + 1;
    const y = year ?? now.getFullYear();

    return this.recurringExpensesService.generateMonthlyExpenses(userId, m, y);
  }
}
