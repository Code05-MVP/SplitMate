
import {
  IsEmail,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @Length(2, 100)
  name: string;

  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @Length(12, 128)
  @Matches(/[a-z]/, {
    message: 'Password must contain a lowercase letter',
  })
  @Matches(/[A-Z]/, {
    message: 'Password must contain an uppercase letter',
  })
  @Matches(/[0-9]/, {
    message: 'Password must contain a number',
  })
  password: string;
}
