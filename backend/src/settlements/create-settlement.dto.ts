import {
  IsInt,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateSettlementDto {
  @IsString()
  @MaxLength(255)
  receiverId: string;

  @IsInt()
  @Min(1)
  amountPaise: number;
}