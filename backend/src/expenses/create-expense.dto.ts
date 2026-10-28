
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
  ArrayMinSize,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

class ExpenseSplitDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ValidateIf(
    (split: ExpenseSplitDto, value: number | undefined) =>
      split.sharePaise !== undefined || value !== undefined,
  )
  @IsInt()
  @Min(1)
  sharePaise?: number;
}

export class CreateExpenseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  description: string;

  @IsInt()
  @Min(1)
  amountPaise: number;

  @IsDateString()
  expenseDate: string;

  @IsEnum(['EQUAL', 'CUSTOM'])
  splitType: 'EQUAL' | 'CUSTOM';

  @IsString()
  @IsNotEmpty()
  payerId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ExpenseSplitDto)
  splits: ExpenseSplitDto[];

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
