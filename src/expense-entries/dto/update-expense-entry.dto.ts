import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
  ValidateIf,
} from 'class-validator';
import { ExpenseCategory, PaymentType } from '@prisma/client';

export class UpdateExpenseEntryDto {
  @ApiPropertyOptional({ example: 150.5 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsOptional()
  amount?: number;

  @ApiPropertyOptional({ enum: ExpenseCategory, nullable: true })
  @ValidateIf((o) => o.expenseCategory !== null)
  @IsEnum(ExpenseCategory)
  @IsOptional()
  expenseCategory?: ExpenseCategory | null;

  @ApiPropertyOptional({ enum: PaymentType, nullable: true })
  @ValidateIf((o) => o.paymentType !== null)
  @IsEnum(PaymentType)
  @IsOptional()
  paymentType?: PaymentType | null;

  @ApiPropertyOptional({ example: '2026-03-15T00:00:00.000Z' })
  @IsDateString()
  @IsOptional()
  date?: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isPriority?: boolean;

  @ApiPropertyOptional({ example: 2 })
  @IsInt()
  @Min(1)
  @IsOptional()
  splitParts?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  userPart?: number;

  @ApiPropertyOptional({ example: 'bank-uuid', nullable: true })
  @ValidateIf((o) => o.bankId !== null)
  @IsUUID()
  @IsOptional()
  bankId?: string | null;
}
