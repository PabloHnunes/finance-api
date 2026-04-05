import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateSalaryDto {
  @ApiPropertyOptional({ example: 'Salário CLT' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isMain?: boolean;

  @ApiPropertyOptional({ example: 4100.0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsOptional()
  amount?: number;

  @ApiPropertyOptional({ example: 1, description: 'Mês de referência (1-12)' })
  @IsInt()
  @Min(1)
  @Max(12)
  @IsOptional()
  month?: number;

  @ApiPropertyOptional({ example: 2026, description: 'Ano de referência' })
  @IsInt()
  @Min(2000)
  @IsOptional()
  year?: number;
}
