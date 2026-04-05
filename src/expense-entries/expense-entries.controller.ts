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
import { ExpenseEntriesService } from './expense-entries.service';
import { CreateExpenseEntryDto } from './dto/create-expense-entry.dto';
import { UpdateExpenseEntryDto } from './dto/update-expense-entry.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OwnershipGuard } from '../auth/guards/ownership.guard';
import { ParseMonthPipe } from '../common/pipes/parse-month.pipe';
import { ParseYearPipe } from '../common/pipes/parse-year.pipe';

@ApiTags('Expense Entries')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OwnershipGuard)
@Controller('expense-entries')
export class ExpenseEntriesController {
  constructor(private readonly expenseEntriesService: ExpenseEntriesService) {}

  @Post(':userId')
  @ApiOperation({ summary: 'Criar registro de gasto' })
  create(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: CreateExpenseEntryDto,
  ) {
    return this.expenseEntriesService.create(userId, dto);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Listar gastos do usuário por mês' })
  @ApiQuery({ name: 'month', required: false, example: 4 })
  @ApiQuery({ name: 'year', required: false, example: 2026 })
  findAll(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() pagination: PaginationDto,
    @Query('month', ParseMonthPipe) month?: number,
    @Query('year', ParseYearPipe) year?: number,
  ) {
    return this.expenseEntriesService.findAllByUser(
      userId,
      month,
      year,
      pagination.limit,
      pagination.offset,
    );
  }

  @Get(':id/user/:userId')
  @ApiOperation({ summary: 'Buscar gasto por ID' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.expenseEntriesService.findOne(id, userId);
  }

  @Put(':id/user/:userId')
  @ApiOperation({ summary: 'Atualizar gasto' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateExpenseEntryDto,
  ) {
    return this.expenseEntriesService.update(id, userId, dto);
  }

  @Delete(':id/user/:userId')
  @ApiOperation({ summary: 'Remover gasto (soft delete)' })
  @ApiQuery({
    name: 'cancelFuture',
    required: false,
    description: 'Cancelar parcelas futuras',
    example: true,
  })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('cancelFuture') cancelFuture?: string,
  ) {
    return this.expenseEntriesService.remove(
      id,
      userId,
      cancelFuture === 'true',
    );
  }

  @Post(':id/user/:userId/settle')
  @ApiOperation({ summary: 'Quitar parcelas restantes' })
  settle(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.expenseEntriesService.settleInstallments(id, userId);
  }
}
