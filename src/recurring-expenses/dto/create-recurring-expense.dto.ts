import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  Validate,
} from 'class-validator';
import { SplitPartsValidator } from '../../common/validators/split-parts.validator';
import { ExpenseCategory, PaymentType } from '@prisma/client';

export class CreateRecurringExpenseDto {
  @ApiProperty({ example: 'Internet' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 120.0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  amount: number;

  @ApiPropertyOptional({ enum: ExpenseCategory })
  @IsEnum(ExpenseCategory)
  @IsOptional()
  expenseCategory?: ExpenseCategory;

  @ApiPropertyOptional({ enum: PaymentType })
  @IsEnum(PaymentType)
  @IsOptional()
  paymentType?: PaymentType;

  @ApiPropertyOptional({ example: true })
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

  @ApiProperty({ example: 10, description: 'Dia de vencimento (1-31)' })
  @IsInt()
  @Min(1)
  @Max(31)
  dueDay: number;

  @ApiProperty({
    example: '2026-04-01',
    description: 'Data de início/assinatura',
  })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({ example: 'bank-uuid' })
  @IsUUID()
  @IsOptional()
  bankId?: string;
}
