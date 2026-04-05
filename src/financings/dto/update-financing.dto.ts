import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class UpdateFinancingDto {
  @ApiPropertyOptional({ example: 'Financiamento Apartamento' })
  @IsString()
  @IsOptional()
  @MaxLength(150)
  description?: string;

  @ApiPropertyOptional({ example: 24, description: 'Parcelas já pagas' })
  @IsInt()
  @Min(0)
  @IsOptional()
  paidInstallments?: number;

  @ApiPropertyOptional({
    example: 0.0065,
    description: 'Nova taxa de juros mensal',
  })
  @IsNumber({ maxDecimalPlaces: 4 })
  @IsOptional()
  interestRate?: number;

  @ApiPropertyOptional({
    example: 2,
    description: 'Em quantas partes divide o gasto',
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  splitParts?: number;

  @ApiPropertyOptional({ example: 1, description: 'Quantas partes são suas' })
  @IsInt()
  @Min(1)
  @IsOptional()
  userPart?: number;

  @ApiPropertyOptional({ example: 'bank-uuid' })
  @IsUUID()
  @IsOptional()
  bankId?: string;

  @ApiPropertyOptional({
    example: 3,
    description: 'Mês a partir do qual a alteração vale (1-12)',
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  fromMonth?: number;

  @ApiPropertyOptional({
    example: 2026,
    description: 'Ano a partir do qual a alteração vale',
  })
  @IsInt()
  @Min(2000)
  @IsOptional()
  fromYear?: number;
}
