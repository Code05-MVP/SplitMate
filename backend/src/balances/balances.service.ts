
import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BalancesService {
  constructor(private readonly prisma: PrismaService) {}

  async getGroupBalances(groupId: string, requesterId: string) {
    const membership = await this.prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: requesterId,
        },
      },
    });

    if (!membership) {
      const group = await this.prisma.group.findUnique({
        where: { id: groupId },
        select: { id: true },
      });

      if (!group) {
        throw new NotFoundException('Group not found');
      }

      throw new ForbiddenException(
        'You must be a group member to view balances',
      );
    }

    const [members, expenses, settlements] = await Promise.all([
      this.prisma.groupMember.findMany({
        where: { groupId },
        select: {
          userId: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),

      this.prisma.expense.findMany({
        where: { groupId, deletedAt: null },
        select: {
          payerId: true,
          amountPaise: true,
          splits: {
            select: {
              userId: true,
              sharePaise: true,
            },
          },
        },
      }),

      this.prisma.settlement.findMany({
        where: { groupId },
        select: {
          payerId: true,
          receiverId: true,
          amountPaise: true,
        },
      }),
    ]);

    const balanceByUser = new Map<string, number>();

    const addBalance = (userId: string, amount: number) => {
      balanceByUser.set(
        userId,
        (balanceByUser.get(userId) ?? 0) + amount,
      );
    };

    for (const member of members) {
      balanceByUser.set(member.userId, 0);
    }

    for (const expense of expenses) {
      addBalance(expense.payerId, expense.amountPaise);

      for (const split of expense.splits) {
        addBalance(split.userId, -split.sharePaise);
      }
    }

    for (const settlement of settlements) {
      addBalance(settlement.payerId, settlement.amountPaise);
      addBalance(settlement.receiverId, -settlement.amountPaise);
    }

    return {
      groupId,
      balances: members.map((member) => ({
        userId: member.userId,
        name: member.user.name,
        email: member.user.email,
        balancePaise: balanceByUser.get(member.userId) ?? 0,
      })),
    };
  }
}
