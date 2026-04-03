import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength, ValidateIf } from 'class-validator';

export class LoginDto {
  @ApiPropertyOptional({ example: 'pablo@email.com' })
  @ValidateIf((o) => !o.username)
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'pablohnunes' })
  @ValidateIf((o) => !o.email)
  @IsString()
  username?: string;

  @ApiPropertyOptional({ example: 'SenhaForte123!' })
  @IsString()
  @MinLength(8)
  password: string;
}
