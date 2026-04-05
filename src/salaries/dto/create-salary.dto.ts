import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateSalaryDto {
  @ApiProperty({ example: 'Salário CLT' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  isMain?: boolean;

  @ApiProperty({ example: 3600.0 })
  @IsNumber({ maxDecimalPlaces: 2 })
  amount: number;

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
