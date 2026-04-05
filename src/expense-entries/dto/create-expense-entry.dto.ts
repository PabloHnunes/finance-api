import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
  Validate,
} from 'class-validator';
import { SplitPartsValidator } from '../../common/validators/split-parts.validator';
import { ExpenseCategory, PaymentType } from '@prisma/client';

export class CreateExpenseEntryDto {
  @ApiProperty({ example: 150.5 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsNotEmpty()
  amount: number;

  @ApiPropertyOptional({ enum: ExpenseCategory })
  @IsEnum(ExpenseCategory)
  @IsOptional()
  expenseCategory?: ExpenseCategory;

  @ApiPropertyOptional({ enum: PaymentType })
  @IsEnum(PaymentType)
  @IsOptional()
  paymentType?: PaymentType;

  @ApiPropertyOptional({
    example: '2026-03-15T00:00:00.000Z',
    description: 'Data do gasto (para cadastro retroativo)',
  })
  @IsDateString()
  @IsOptional()
  date?: string;

  @ApiPropertyOptional({ example: true, description: 'Gasto prioritário' })
  @IsBoolean()
  @IsOptional()
  isPriority?: boolean;

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
  @Validate(SplitPartsValidator)
  userPart?: number;

  @ApiPropertyOptional({ example: 'bank-uuid' })
  @IsUUID()
  @IsOptional()
  bankId?: string;

  @ApiPropertyOptional({ example: 3, description: 'Número total de parcelas' })
  @IsInt()
  @Min(1)
  @IsOptional()
  installmentCount?: number;

  @ApiPropertyOptional({ example: 1, description: 'Parcela atual' })
  @IsInt()
  @Min(1)
  @IsOptional()
  installmentNumber?: number;
}
