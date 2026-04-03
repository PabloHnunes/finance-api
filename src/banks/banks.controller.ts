import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { BanksService } from './banks.service';
import { CreateBankDto } from './dto/create-bank.dto';
import { UpdateBankDto } from './dto/update-bank.dto';

@ApiTags('Banks')
@Controller('banks')
export class BanksController {
  constructor(private readonly banksService: BanksService) {}

  @Post(':userId')
  @ApiOperation({ summary: 'Criar banco vinculado ao usuário' })
  create(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: CreateBankDto,
  ) {
    return this.banksService.create(userId, dto);
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Listar bancos do usuário' })
  findAll(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.banksService.findAllByUser(userId);
  }

  @Get(':id/user/:userId')
  @ApiOperation({ summary: 'Buscar banco por ID' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.banksService.findOne(id, userId);
  }

  @Put(':id/user/:userId')
  @ApiOperation({ summary: 'Atualizar banco' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateBankDto,
  ) {
    return this.banksService.update(id, userId, dto);
  }

  @Delete(':id/user/:userId')
  @ApiOperation({ summary: 'Remover banco' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.banksService.remove(id, userId);
  }
}
