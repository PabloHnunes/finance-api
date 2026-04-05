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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { SalariesService } from './salaries.service';
import { CreateSalaryDto } from './dto/create-salary.dto';
import { UpdateSalaryDto } from './dto/update-salary.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OwnershipGuard } from '../auth/guards/ownership.guard';
import { ParseMonthPipe } from '../common/pipes/parse-month.pipe';
import { ParseYearPipe } from '../common/pipes/parse-year.pipe';

@ApiTags('Salaries')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OwnershipGuard)
@Controller('salaries')
export class SalariesController {
  constructor(private readonly salariesService: SalariesService) {}

  @Post(':userId')
  @ApiOperation({ summary: 'Criar salário vinculado ao usuário' })
  create(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: CreateSalaryDto,
  ) {
    return this.salariesService.create(userId, dto);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Listar salários do usuário' })
  @ApiQuery({ name: 'month', required: false, example: 3 })
  @ApiQuery({ name: 'year', required: false, example: 2026 })
  findAll(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() pagination: PaginationDto,
    @Query('month', ParseMonthPipe) month?: number,
    @Query('year', ParseYearPipe) year?: number,
  ) {
    return this.salariesService.findAllByUser(
      userId,
      pagination.limit,
      pagination.offset,
      month,
      year,
    );
  }

  @Get(':id/user/:userId')
  @ApiOperation({ summary: 'Buscar salário por ID' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.salariesService.findOne(id, userId);
  }

  @Put(':id/user/:userId')
  @ApiOperation({ summary: 'Atualizar salário' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateSalaryDto,
  ) {
    return this.salariesService.update(id, userId, dto);
  }

  @Delete(':id/user/:userId')
  @ApiOperation({ summary: 'Remover salário e histórico' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.salariesService.remove(id, userId);
  }
}
