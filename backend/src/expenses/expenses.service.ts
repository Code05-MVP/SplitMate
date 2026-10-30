
import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ActivityService } from '../activity/activity.service';
import { UpdateExpenseDto } from './update-expense.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExpenseDto } from './create-expense.dto';
import { ActivityAction } from '../../generated/prisma/client';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityService: ActivityService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  // Create an expense
    
  // Create an expense
  async createExpense(
    groupId: string,
    requesterId: string,
    dto: CreateExpenseDto,
  ) {
    const membership = await this.prisma.groupMember.findUnique({
      where: {
        groupId_userId: { groupId, userId: requesterId },
      },
    });

    if (!membership) {
      throw new ForbiddenException(
        'You must be a group member to create an expense',
      );
    }

    if (!Array.isArray(dto.splits) || dto.splits.length === 0) {
      throw new BadRequestException(
        'Select at least one member to split this expense',
      );
    }

    const splitUserIds = dto.splits.map((split) => split.userId);
    const uniqueSplitUserIds = [...new Set(splitUserIds)];

    if (uniqueSplitUserIds.length !== splitUserIds.length) {
      throw new BadRequestException(
        'A user cannot appear more than once in an expense split',
      );
    }

    const splitMembers = await this.prisma.groupMember.findMany({
      where: {
        groupId,
        userId: { in: uniqueSplitUserIds },
      },
      select: { userId: true },
    });

    if (splitMembers.length !== uniqueSplitUserIds.length) {
      throw new BadRequestException(
        'Every split user must be a member of this group',
      );
    }

    const payerMembership = await this.prisma.groupMember.findUnique({
      where: {
        groupId_userId: { groupId, userId: dto.payerId },
      },
    });

    if (!payerMembership) {
      throw new BadRequestException(
        'The payer must be a member of this group',
      );
    }

    let calculatedSplits: { userId: string; sharePaise: number }[];

    if (dto.splitType === 'EQUAL') {
      const baseShare = Math.floor(
        dto.amountPaise / uniqueSplitUserIds.length,
      );
      const leftoverPaise =
        dto.amountPaise % uniqueSplitUserIds.length;

      // Deterministic rule: sorted user IDs receive leftover paise first.
      const sortedUserIds = [...uniqueSplitUserIds].sort();

      calculatedSplits = sortedUserIds.map((userId, index) => ({
        userId,
        sharePaise: baseShare + (index < leftoverPaise ? 1 : 0),
      }));
    } else {
      if (
        dto.splits.some(
          (split) =>
            !Number.isInteger(split.sharePaise) ||
            split.sharePaise === undefined ||
            split.sharePaise < 1,
        )
      ) {
        throw new BadRequestException(
          'Every selected member must have a positive whole-paise share for a custom split',
        );
      }

      calculatedSplits = dto.splits.map((split) => ({
        userId: split.userId,
        sharePaise: split.sharePaise!,
      }));
    }

    const totalShares = calculatedSplits.reduce(
      (total, split) => total + split.sharePaise,
      0,
    );

    if (totalShares !== dto.amountPaise) {
      throw new BadRequestException(
        `The sum of all shares must equal the expense amount. Shares total ${totalShares} paise, but the expense is ${dto.amountPaise} paise.`,
      );
    }

    // Save the expense and its splits atomically.
    const expense = await this.prisma.$transaction(async (tx) => {
      return tx.expense.create({
        data: {
          description: dto.description.trim(),
          amountPaise: dto.amountPaise,
          expenseDate: new Date(dto.expenseDate),
          splitType: dto.splitType,
          groupId,
          creatorId: requesterId,
          payerId: dto.payerId,
          splits: {
            create: calculatedSplits.map((split) => ({
              sharePaise: split.sharePaise,
              user: {
                connect: { id: split.userId },
              },
            })),
          },
        },
        include: { splits: true },
      });
    });

    // Record activity after the expense transaction commits.
    await this.activityService.logActivity(
      requesterId,
      groupId,
      ActivityAction.EXPENSE_CREATED,
      `Created expense: ${expense.description}`,
      {
        expenseId: expense.id,
        amountPaise: expense.amountPaise,
      },
    );

    // Notify connected group members.
    this.realtimeGateway.broadcastToGroup(
      groupId,
      'group:expense-created',
      {
        expenseId: expense.id,
        description: expense.description,
        amountPaise: expense.amountPaise,
        payerId: expense.payerId,
      },
    );

    this.broadcastGroupRefresh(groupId);

    return expense;
  }


  // Get paginated group expenses.
  async getGroupExpenses(
    groupId: string,
    requesterId: string,
    page: number = 1,
    limit: number = 10,
    sortBy: 'expenseDate' | 'amountPaise' | 'createdAt' = 'expenseDate',
    order: 'asc' | 'desc' = 'desc',
  ) {
    const membership = await this.prisma.groupMember.findUnique({
      where: {
        groupId_userId: { groupId, userId: requesterId },
      },
    });

    if (!membership) {
      throw new ForbiddenException(
        'You must be a group member to view expenses',
      );
    }

    const safePage = Math.max(1, Math.floor(page));
    const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));

    const [expenses, total] = await this.prisma.$transaction([
      this.prisma.expense.findMany({
        where: { groupId, deletedAt: null },
        skip: (safePage - 1) * safeLimit,
        take: safeLimit,
        orderBy: { [sortBy]: order },
            
include: {
  splits: {
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  },
  payer: {
    select: { id: true, name: true, email: true },
  },
  creator: {
    select: { id: true },
  },
},

      }),
      this.prisma.expense.count({
        where: { groupId, deletedAt: null },
      }),
    ]);

    return {
      data: expenses,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  }

  // Update an existing expense.
    
  // Update an existing expense.
  async updateExpense(
    groupId: string,
    expenseId: string,
    requesterId: string,
    dto: UpdateExpenseDto,
  ) {
    const expense = await this.prisma.expense.findFirst({
      where: { id: expenseId, groupId, deletedAt: null },
      include: { splits: true },
    });

    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    const group = await this.prisma.group.findUnique({
  where: { id: groupId },
  select: { ownerId: true },
});

if (
  expense.creatorId !== requesterId &&
  group?.ownerId !== requesterId
) {
  throw new ForbiddenException(
    'Only the expense creator or group owner can edit it',
  );
}

    const membership = await this.prisma.groupMember.findUnique({
      where: {
        groupId_userId: { groupId, userId: requesterId },
      },
    });

    if (!membership) {
      throw new ForbiddenException(
        'You must be a group member to edit this expense',
      );
    }

    const amountPaise = dto.amountPaise ?? expense.amountPaise;
    const payerId = dto.payerId ?? expense.payerId;
    const splitType = dto.splitType ?? expense.splitType;

    const payerMembership = await this.prisma.groupMember.findUnique({
      where: {
        groupId_userId: { groupId, userId: payerId },
      },
    });

    if (!payerMembership) {
      throw new BadRequestException(
        'The payer must be a member of this group',
      );
    }

    // Preserve existing participants unless new ones are supplied.
    const selectedSplits =
      dto.splits ??
      expense.splits.map((split) => ({
        userId: split.userId,
        sharePaise: split.sharePaise,
      }));

    if (selectedSplits.length === 0) {
      throw new BadRequestException(
        'Select at least one member to split this expense',
      );
    }

    const splitUserIds = selectedSplits.map((split) => split.userId);
    const uniqueUserIds = [...new Set(splitUserIds)];

    if (uniqueUserIds.length !== splitUserIds.length) {
      throw new BadRequestException(
        'A user cannot appear more than once in an expense split',
      );
    }

    const splitMembers = await this.prisma.groupMember.findMany({
      where: {
        groupId,
        userId: { in: uniqueUserIds },
      },
      select: { userId: true },
    });

    if (splitMembers.length !== uniqueUserIds.length) {
      throw new BadRequestException(
        'Every split user must be a member of this group',
      );
    }

    let calculatedSplits: { userId: string; sharePaise: number }[];

    if (splitType === 'EQUAL') {
      const baseShare = Math.floor(
        amountPaise / uniqueUserIds.length,
      );
      const leftoverPaise = amountPaise % uniqueUserIds.length;
      const sortedUserIds = [...uniqueUserIds].sort();

      calculatedSplits = sortedUserIds.map((userId, index) => ({
        userId,
        sharePaise: baseShare + (index < leftoverPaise ? 1 : 0),
      }));
    } else {
      if (
        selectedSplits.some(
          (split) =>
            !Number.isInteger(split.sharePaise) ||
            split.sharePaise === undefined ||
            split.sharePaise < 1,
        )
      ) {
        throw new BadRequestException(
          'Every selected member must have a positive whole-paise share for a custom split',
        );
      }

      calculatedSplits = selectedSplits.map((split) => ({
        userId: split.userId,
        sharePaise: split.sharePaise!,
      }));
    }

    const totalShares = calculatedSplits.reduce(
      (total, split) => total + split.sharePaise,
      0,
    );

    if (totalShares !== amountPaise) {
      throw new BadRequestException(
        `The sum of all shares must equal the expense amount. Shares total ${totalShares} paise, but the expense is ${amountPaise} paise.`,
      );
    }

    // Update the expense and its splits atomically.
    const updatedExpense = await this.prisma.$transaction(async (tx) => {
      await tx.expenseSplit.deleteMany({
        where: { expenseId },
      });

      return tx.expense.update({
        where: { id: expenseId },
        data: {
          description: dto.description?.trim() ?? expense.description,
          amountPaise,
          expenseDate: dto.expenseDate
            ? new Date(dto.expenseDate)
            : expense.expenseDate,
          splitType,
          payerId,
          version: { increment: 1 },
          splits: {
            create: calculatedSplits.map((split) => ({
              sharePaise: split.sharePaise,
              user: {
                connect: { id: split.userId },
              },
            })),
          },
        },
        include: { splits: true },
      });
    });

    await this.activityService.logActivity(
      requesterId,
      groupId,
      ActivityAction.EXPENSE_UPDATED,
      `Updated expense: ${updatedExpense.description}`,
      { expenseId },
    );

    this.realtimeGateway.broadcastToGroup(
      groupId,
      'group:expense-updated',
      {
        expenseId,
        description: updatedExpense.description,
      },
    );

    this.broadcastGroupRefresh(groupId);

    return updatedExpense;
  }


  // Soft-delete an expense to preserve financial history.
  async deleteExpense(
    groupId: string,
    expenseId: string,
    requesterId: string,
  ) {
    const expense = await this.prisma.expense.findFirst({
      where: { id: expenseId, groupId, deletedAt: null },
    });

    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

               const group = await this.prisma.group.findUnique({
  where: { id: groupId },
  select: { ownerId: true },
});

if (
  expense.creatorId !== requesterId &&
  group?.ownerId !== requesterId
) {
  throw new ForbiddenException(
    'Only the expense creator or group owner can delete it',
  );
}

    const membership = await this.prisma.groupMember.findUnique({
      where: {
        groupId_userId: { groupId, userId: requesterId },
      },
    });

    if (!membership) {
      throw new ForbiddenException(
        'You must be a group member to delete this expense',
      );
    }

    const deletedExpense = await this.prisma.$transaction(async (tx) => {
      return tx.expense.update({
        where: { id: expenseId },
        data: {
          deletedAt: new Date(),
          version: { increment: 1 },
        },
      });
    });

    await this.activityService.logActivity(
      requesterId,
      groupId,
      ActivityAction.EXPENSE_DELETED,
      `Deleted expense: ${expense.description}`,
      { expenseId },
    );

    this.realtimeGateway.broadcastToGroup(
      groupId,
      'group:expense-deleted',
      { expenseId },
    );

    this.broadcastGroupRefresh(groupId);

    return deletedExpense;
  }

  // Tell connected clients to refetch balances and activity.
  private broadcastGroupRefresh(groupId: string) {
    this.realtimeGateway.broadcastToGroup(
      groupId,
      'group:balance-updated',
      { groupId },
    );

    this.realtimeGateway.broadcastToGroup(
      groupId,
      'group:activity-updated',
      { groupId },
    );
  }
}
