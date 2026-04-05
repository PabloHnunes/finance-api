import { PartialType } from '@nestjs/swagger';
import { CreateRecurringExpenseDto } from './create-recurring-expense.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateRecurringExpenseDto extends PartialType(
  CreateRecurringExpenseDto,
) {
  @ApiPropertyOptional({
    example: false,
    description: 'Ativar/desativar recorrência',
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    example: 2,
    description: 'Mês a partir do qual a alteração vale (1-12)',
  })
  @IsInt()
  @Min(1)
  @Max(12)
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
