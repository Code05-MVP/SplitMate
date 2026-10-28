
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty, // Add this line
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

class UpdateExpenseSplitDto {
  @IsString()
  userId: string;

  @ValidateIf(
    (split: UpdateExpenseSplitDto, value: number | undefined) =>
      split.sharePaise !== undefined || value !== undefined,
  )
  @IsInt()
  @Min(1)
  sharePaise?: number;
}

export class UpdateExpenseDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  amountPaise?: number;

  @IsOptional()
  @IsDateString()
  expenseDate?: string;

  @IsOptional()
  @IsIn(['EQUAL', 'CUSTOM'])
  splitType?: 'EQUAL' | 'CUSTOM';

   @IsOptional()
   @IsString()
  @IsNotEmpty()
  payerId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdateExpenseSplitDto)
  splits?: UpdateExpenseSplitDto[];
}
