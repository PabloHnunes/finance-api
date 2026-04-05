import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, ValidateIf } from 'class-validator';

export class LoginDto {
  @ApiPropertyOptional({ example: 'pablo@email.com' })
  @ValidateIf((o: LoginDto) => !o.username)
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'pablohnunes' })
  @ValidateIf((o: LoginDto) => !o.email)
  @IsString()
  username?: string;

  @ApiPropertyOptional({ example: 'SenhaForte123!' })
  @IsString()
  @MinLength(8)
  password: string;
}
