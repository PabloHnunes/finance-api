import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FinancingsService } from './financings.service';
import { CreateFinancingDto } from './dto/create-financing.dto';
import { UpdateFinancingDto } from './dto/update-financing.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OwnershipGuard } from '../auth/guards/ownership.guard';

@ApiTags('Financings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OwnershipGuard)
@Controller('financings')
export class FinancingsController {
  constructor(private readonly financingsService: FinancingsService) {}

  @Post(':userId')
  @ApiOperation({ summary: 'Criar financiamento/empréstimo' })
  create(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: CreateFinancingDto,
  ) {
    return this.financingsService.create(userId, dto);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Listar financiamentos do usuário' })
  findAll(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.financingsService.findAllByUser(userId);
  }

  @Get(':id/user/:userId')
  @ApiOperation({ summary: 'Buscar financiamento por ID' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.financingsService.findOne(id, userId);
  }

  @Get(':id/user/:userId/installments')
  @ApiOperation({ summary: 'Listar todas as parcelas do financiamento' })
  findInstallments(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.financingsService.findInstallments(id, userId);
  }

  @Get(':id/user/:userId/schedule')
  @ApiOperation({ summary: 'Tabela completa de parcelas (SAC/Price)' })
  getSchedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.financingsService.getSchedule(id, userId);
  }

  @Put(':id/user/:userId')
  @ApiOperation({ summary: 'Atualizar financiamento' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateFinancingDto,
  ) {
    return this.financingsService.update(id, userId, dto);
  }

  @Delete(':id/user/:userId')
  @ApiOperation({ summary: 'Remover parcela atual e futuras' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.financingsService.remove(id, userId);
  }

  @Delete(':id/user/:userId/all')
  @ApiOperation({ summary: 'Remover todas as parcelas do financiamento' })
  removeAll(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.financingsService.removeAll(id, userId);
  }
}
