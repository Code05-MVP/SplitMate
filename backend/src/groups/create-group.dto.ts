
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class CreateGroupDto {
  @IsString()
  @Length(2, 100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
