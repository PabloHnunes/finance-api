import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'pablo@email.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'pablohnunes' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(30)
  username: string;

  @ApiProperty({ example: 'Pablo' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Nunes' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: '12345678900' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(11)
  cpf: string;

  @ApiProperty({ example: '1990-01-15' })
  @IsDateString()
  birthDate: string;

  @ApiProperty({ example: 'Rua das Flores' })
  @IsString()
  @IsNotEmpty()
  street: string;

  @ApiProperty({ example: 'Centro' })
  @IsString()
  @IsNotEmpty()
  neighborhood: string;

  @ApiProperty({ example: 'SP' })
  @IsString()
  @MaxLength(2)
  @MinLength(2)
  state: string;

  @ApiProperty({ example: 'São Paulo' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ example: '123' })
  @IsString()
  @IsNotEmpty()
  number: string;

  @ApiProperty({ example: '01001-000' })
  @IsString()
  @MaxLength(9)
  zipCode: string;

  @ApiProperty({ example: 'SenhaForte123!' })
  @IsString()
  @MinLength(8)
  password: string;
}
