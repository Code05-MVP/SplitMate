
import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { ActivityAction } from '../../generated/prisma/client';

@Injectable()
export class GroupsService {
  constructor(
  private readonly prisma: PrismaService,
  private readonly activityService: ActivityService,
) {}
  

async createGroup(
  name: string,
  ownerId: string,
  description?: string,
) {
  const group = await this.prisma.group.create({
    data: {
      name: name.trim(),
      description: description?.trim(),
      ownerId,
      members: {
        create: {
          userId: ownerId,
          role: 'OWNER',
        },
      },
    },
    include: {
      members: true,
    },
  });

  await this.activityService.logActivity(
    ownerId,
    group.id,
    ActivityAction.GROUP_CREATED,
    `Created group: ${group.name}`,
    {
      groupName: group.name,
    },
  );

  return group;
}

async getMyGroups(userId: string) {
  return this.prisma.group.findMany({
    where: {
      members: {
        some: {
          userId,
        },
      },
    },
    include: {
     
members: {
  select: {
    userId: true,
    role: true,
    joinedAt: true,
    user: {
      select: {
        name: true,
        email: true,
      },
    },
  },
},

    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

async getGroupExpensesForBalance(groupId: string) {
  return this.prisma.expense.findMany({
    where: {
      groupId,
      deletedAt: null,
    },
    select: {
      amountPaise: true,
      payerId: true,
      splits: {
        select: {
          userId: true,
          sharePaise: true,
        },
      },
    },
  });
}

async getGroupSettlementsForBalance(groupId: string) {
  return this.prisma.settlement.findMany({
    where: {
      groupId,
    },
    select: {
      payerId: true,
      receiverId: true,
      amountPaise: true,
    },
  });
}

async calculateGroupBalances(groupId: string) {
  const expenses = await this.getGroupExpensesForBalance(groupId);
  const settlements = await this.getGroupSettlementsForBalance(groupId);

  // Store each member's balance in paise.
  const balances = new Map<string, number>();

  const updateBalance = (userId: string, amount: number) => {
    balances.set(
      userId,
      (balances.get(userId) ?? 0) + amount,
    );
  };

  // Expenses: payer receives credit; each person owes their share.
  for (const expense of expenses) {
    updateBalance(expense.payerId, expense.amountPaise);

    for (const split of expense.splits) {
      updateBalance(split.userId, -split.sharePaise);
    }
  }

  // Settlements: sender's debt decreases; receiver's credit decreases.
  for (const settlement of settlements) {
    updateBalance(settlement.payerId, settlement.amountPaise);
    updateBalance(settlement.receiverId, -settlement.amountPaise);
  }

  return Object.fromEntries(balances);
}

async getGroupBalances(groupId: string, requesterId: string) {
  // Verify that the group exists.
  const group = await this.prisma.group.findUnique({
    where: { id: groupId },
  });

  if (!group) {
    throw new NotFoundException('Group not found');
  }

  // Only group members can view the group's balances.
  const membership = await this.prisma.groupMember.findUnique({
    where: {
      groupId_userId: {
        groupId,
        userId: requesterId,
      },
    },
  });

  if (!membership) {
    throw new ForbiddenException(
      'You must be a group member to view balances',
    );
  }

  // Calculate each member's net balance in paise.
  const balances = await this.calculateGroupBalances(groupId);

  return Object.entries(balances).map(([userId, balancePaise]) => ({
    userId,
    balancePaise,
    balanceRupees: balancePaise / 100,
  }));
}




async addGroupMember(
  groupId: string,
  requesterId: string,
  email: string,
) {
  const group = await this.prisma.group.findUnique({
    where: { id: groupId },
  });

  if (!group) {
    throw new NotFoundException('Group not found');
  }

  if (group.ownerId !== requesterId) {
    throw new ForbiddenException(
      'Only the group owner can add members',
    );
  }

  const user = await this.prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
  });

  if (!user || !user.isActive) {
    throw new NotFoundException(
      'Active registered user not found with this email',
    );
  }

  const existingMembership = await this.prisma.groupMember.findUnique({
    where: {
      groupId_userId: {
        groupId,
        userId: user.id,
      },
    },
  });

  if (existingMembership) {
    throw new ConflictException(
      'User is already a member of this group',
    );
  }

  const membership = await this.prisma.groupMember.create({
    data: {
      groupId,
      userId: user.id,
      role: 'MEMBER',
    },
    select: {
      groupId: true,
      userId: true,
      role: true,
      joinedAt: true,
    },
  });

  await this.activityService.logActivity(
    requesterId,
    groupId,
    ActivityAction.MEMBER_ADDED,
    `Added ${user.name} to the group`,
    {
      addedUserId: user.id,
      addedUserEmail: user.email,
    },
  );

  return membership;
}




async removeGroupMember(
  groupId: string,
  memberId: string,
  requesterId: string,
) {
  // Run the balance checks and membership deletion in one transaction.
  const result = await this.prisma.$transaction(async (tx) => {
    const group = await tx.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (group.ownerId !== requesterId) {
      throw new ForbiddenException(
        'Only the group owner can remove members',
      );
    }

    if (memberId === group.ownerId) {
      throw new ConflictException(
        'The group owner cannot be removed',
      );
    }

    const membership = await tx.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: memberId,
        },
      },
    });

    if (!membership) {
      throw new NotFoundException(
        'User is not a member of this group',
      );
    }

    // Fetch active expenses and settlements.
    const expenses = await tx.expense.findMany({
      where: {
        groupId,
        deletedAt: null,
      },
      select: {
        amountPaise: true,
        payerId: true,
        splits: {
          select: {
            userId: true,
            sharePaise: true,
          },
        },
      },
    });

    const settlements = await tx.settlement.findMany({
      where: { groupId },
      select: {
        payerId: true,
        receiverId: true,
        amountPaise: true,
      },
    });

    // Calculate the member's net balance in integer paise.
    const balances = new Map<string, number>();

    const updateBalance = (userId: string, amount: number) => {
      balances.set(
        userId,
        (balances.get(userId) ?? 0) + amount,
      );
    };

    for (const expense of expenses) {
      updateBalance(expense.payerId, expense.amountPaise);

      for (const split of expense.splits) {
        updateBalance(split.userId, -split.sharePaise);
      }
    }

    for (const settlement of settlements) {
      updateBalance(settlement.payerId, settlement.amountPaise);
      updateBalance(settlement.receiverId, -settlement.amountPaise);
    }

    const memberBalance = balances.get(memberId) ?? 0;

    if (memberBalance !== 0) {
      throw new ConflictException(
        'Cannot remove a member with an outstanding group balance',
      );
    }

    // Delete only after the balance check passes.
    await tx.groupMember.delete({
      where: {
        groupId_userId: {
          groupId,
          userId: memberId,
        },
      },
    });

    return {
      message: 'Group member removed successfully',
      groupId,
      memberId,
    };
  });

  // Record activity after the membership transaction succeeds.
  await this.activityService.logActivity(
    requesterId,
    groupId,
    ActivityAction.MEMBER_REMOVED,
    'Removed a member from the group',
    { removedUserId: memberId },
  );

  return result;
}

async deleteGroup(groupId: string, requesterId: string) {
  const group = await this.prisma.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      ownerId: true,
      name: true,
    },
  });

  if (!group) {
    throw new NotFoundException('Group not found');
  }

  if (group.ownerId !== requesterId) {
    throw new ForbiddenException(
      'Only the group owner can delete this group',
    );
  }

  await this.prisma.$transaction(async (tx) => {
    // Related members, expenses, splits, settlements, and activity
    // records are deleted by the configured cascade relationships.
    await tx.group.delete({
      where: { id: groupId },
    });
  });

  return {
    message: 'Group deleted successfully',
    groupId,
  };
}





}
