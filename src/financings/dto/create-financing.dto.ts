import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  Validate,
} from 'class-validator';
import { SplitPartsValidator } from '../../common/validators/split-parts.validator';
import {
  FinancingType,
  AmortizationType,
  ExpenseCategory,
  PaymentType,
} from '@prisma/client';
import { MaxLength } from 'class-validator';

export class CreateFinancingDto {
  @ApiPropertyOptional({ example: 'Placas solares' })
  @IsString()
  @IsOptional()
  @MaxLength(150)
  description?: string;

  @ApiProperty({ enum: FinancingType })
  @IsEnum(FinancingType)
  financingType: FinancingType;

  @ApiPropertyOptional({
    enum: ExpenseCategory,
    description: 'Categoria do gasto (obrigatório para tipo OTHER)',
  })
  @IsEnum(ExpenseCategory)
  @IsOptional()
  expenseCategory?: ExpenseCategory;

  @ApiProperty({ enum: AmortizationType, example: 'SAC' })
  @IsEnum(AmortizationType)
  amortizationType: AmortizationType;

  @ApiProperty({ example: 300000.0, description: 'Valor total financiado' })
  @IsNumber({ maxDecimalPlaces: 2 })
  totalAmount: number;

  @ApiPropertyOptional({
    example: 0.0075,
    description: 'Taxa de juros mensal (ex: 0.75% = 0.0075)',
  })
  @IsNumber({ maxDecimalPlaces: 6 })
  @IsOptional()
  interestRate?: number;

  @ApiPropertyOptional({
    example: 0.09,
    description:
      'Taxa de juros nominal anual (ex: 9% = 0.09). Convertida para mensal: nominal / 12',
  })
  @IsNumber({ maxDecimalPlaces: 6 })
  @IsOptional()
  nominalAnnualRate?: number;

  @ApiPropertyOptional({
    example: 0.0938,
    description:
      'Taxa de juros efetiva anual (ex: 9.38% = 0.0938). Convertida para mensal: (1 + efetiva)^(1/12) - 1',
  })
  @IsNumber({ maxDecimalPlaces: 6 })
  @IsOptional()
  effectiveAnnualRate?: number;

  @ApiPropertyOptional({
    example: 0.0012,
    description:
      'Taxa de correção monetária mensal (TR). Ex: 0.12% = 0.0012. Corrige o saldo devedor antes do cálculo de cada parcela.',
  })
  @IsNumber({ maxDecimalPlaces: 6 })
  @IsOptional()
  monetaryCorrection?: number;

  @ApiPropertyOptional({
    example: [
      { name: 'TA2', type: 'FIXED', value: 25 },
      { name: 'FGHAB', type: 'ON_BALANCE', value: 26.48 },
    ],
    description:
      'Taxas do financiamento. Para FIXED informe o valor mensal. Para ON_BALANCE, ON_INSTALLMENT e ON_TOTAL_AMOUNT informe o valor em reais da 1ª parcela — a API calcula a taxa automaticamente.',
  })
  @IsOptional()
  fees?: Array<{ name: string; type: string; value: number }>;

  @ApiProperty({ example: 360, description: 'Total de parcelas' })
  @IsInt()
  @Min(1)
  totalInstallments: number;

  @ApiPropertyOptional({ example: 12, description: 'Parcelas já pagas' })
  @IsInt()
  @Min(0)
  @IsOptional()
  paidInstallments?: number;

  @ApiProperty({ example: 1, description: 'Mês de início (1-12)' })
  @IsInt()
  @Min(1)
  @Max(12)
  startMonth: number;

  @ApiProperty({ example: 2024 })
  @IsInt()
  @Min(2000)
  startYear: number;

  @ApiPropertyOptional({ enum: PaymentType })
  @IsEnum(PaymentType)
  @IsOptional()
  paymentType?: PaymentType;

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
}
