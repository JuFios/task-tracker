import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { MaxByteLength } from '../common/validators/max-byte-length';

export class RegisterDto {
  @ApiProperty({ example: 'Ada Lovelace' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @ApiProperty({ example: 'ada@example.com' })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: 'Str0ngPassword!', minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8)
  @MaxByteLength(72, {
    message: 'Password must be at most 72 bytes (bcrypt truncates longer input)',
  })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'Password must contain at least one letter and one digit',
  })
  password: string;
}

export class LoginDto {
  @ApiProperty({ example: 'ada@example.com' })
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ example: 'Str0ngPassword!' })
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class RefreshDto {
  @ApiProperty({
    example: 'd3f47c56a6a1…',
    description: 'Opaque refresh token returned by login/register/refresh',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
