import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { UpdateExpenseDto } from './update-expense.dto';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './create-expense.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/v1/groups/:groupId/expenses')
@UseGuards(JwtAuthGuard)
export class ExpensesController {
  constructor(
    private readonly expensesService: ExpensesService,
  ) {}

  @Post()
  async createExpense(
    @Param('groupId') groupId: string,
    @Body() dto: CreateExpenseDto,
    @Req() req: { user: { userId: string } },
  ) {
    return this.expensesService.createExpense(
      groupId,
      req.user.userId,
      dto,
    );
  }
  
@Get()
async getGroupExpenses(
  @Param('groupId') groupId: string,
  @Req() req: { user: { userId: string } },
  @Query('page') page?: string,
  @Query('limit') limit?: string,
  @Query('sortBy') sortBy?: string,
  @Query('order') order?: string,
) {
  const parsedPage = page === undefined ? 1 : Number(page);
  const parsedLimit = limit === undefined ? 10 : Number(limit);

  if (!Number.isInteger(parsedPage) || parsedPage < 1) {
    throw new BadRequestException('Page must be a positive integer');
  }

  if (!Number.isInteger(parsedLimit) || parsedLimit < 1) {
    throw new BadRequestException('Limit must be a positive integer');
  }

  const allowedSortFields = [
    'expenseDate',
    'amountPaise',
    'createdAt',
  ];

  if (sortBy !== undefined && !allowedSortFields.includes(sortBy)) {
    throw new BadRequestException('Invalid sortBy value');
  }

  if (order !== undefined && order !== 'asc' && order !== 'desc') {
    throw new BadRequestException('Order must be asc or desc');
  }

  return this.expensesService.getGroupExpenses(
    groupId,
    req.user.userId,
    parsedPage,
    parsedLimit,
    (sortBy ?? 'expenseDate') as
      | 'expenseDate'
      | 'amountPaise'
      | 'createdAt',
    (order ?? 'desc') as 'asc' | 'desc',
  );
}

@Patch(':expenseId')
async updateExpense(
  @Param('groupId') groupId: string,
  @Param('expenseId') expenseId: string,
  @Body() dto: UpdateExpenseDto,
  @Req() req: { user: { userId: string } },
) {
  return this.expensesService.updateExpense(
    groupId,
    expenseId,
    req.user.userId,
    dto,
  );
}
@Delete(':expenseId')
async deleteExpense(
  @Param('groupId') groupId: string,
  @Param('expenseId') expenseId: string,
  @Req() req: { user: { userId: string } },
) {
  return this.expensesService.deleteExpense(
    groupId,
    expenseId,
    req.user.userId,
  );
}
}
