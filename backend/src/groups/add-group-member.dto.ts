
import { IsEmail, MaxLength } from 'class-validator';

export class AddGroupMemberDto {
  @IsEmail()
  @MaxLength(255)
  email: string;
}
