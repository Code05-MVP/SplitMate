import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ActivityService } from '../activity/activity.service';
import { ActivityAction } from '../../generated/prisma/client';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSettlementDto } from './create-settlement.dto';

@Injectable()
export class SettlementsService {
  constructor(
  private readonly prisma: PrismaService,
  private readonly activityService: ActivityService,
   private readonly realtimeGateway: RealtimeGateway,
) {}

  async createSettlement(
    groupId: string,
    requesterId: string,
    dto: CreateSettlementDto,
  ) {
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    const memberships = await this.prisma.groupMember.findMany({
      where: {
        groupId,
        userId: { in: [requesterId, dto.receiverId] },
      },
      select: { userId: true },
    });

    if (!memberships.some((m) => m.userId === requesterId)) {
      throw new ForbiddenException(
        'You must be a group member to record a settlement',
      );
    }

    if (!memberships.some((m) => m.userId === dto.receiverId)) {
      throw new BadRequestException(
        'The receiver must be a member of this group',
      );
    }

    if (requesterId === dto.receiverId) {
      throw new BadRequestException(
        'You cannot settle a debt with yourself',
      );
    }

    
const settlement = await this.prisma.$transaction(async (tx) => {
  const expenses = await tx.expense.findMany({
    where: { groupId, deletedAt: null },
    select: {
      amountPaise: true,
      payerId: true,
      splits: {
        select: { userId: true, sharePaise: true },
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

  const balances = new Map<string, number>();

  const addBalance = (userId: string, amount: number) => {
    balances.set(userId, (balances.get(userId) ?? 0) + amount);
  };

  for (const expense of expenses) {
    addBalance(expense.payerId, expense.amountPaise);

    for (const split of expense.splits) {
      addBalance(split.userId, -split.sharePaise);
    }
  }

  for (const existingSettlement of settlements) {
    addBalance(existingSettlement.payerId, existingSettlement.amountPaise);
    addBalance(existingSettlement.receiverId, -existingSettlement.amountPaise);
  }

  const requesterBalance = balances.get(requesterId) ?? 0;
  const receiverBalance = balances.get(dto.receiverId) ?? 0;

  const debtOwedToReceiver = Math.min(
    Math.max(0, -requesterBalance),
    Math.max(0, receiverBalance),
  );

  if (
    debtOwedToReceiver <= 0 ||
    dto.amountPaise > debtOwedToReceiver
  ) {
    throw new BadRequestException(
      'Settlement amount exceeds the debt owed to this receiver',
    );
  }

  return tx.settlement.create({
    data: {
      groupId,
      payerId: requesterId,
      receiverId: dto.receiverId,
      amountPaise: dto.amountPaise,
    },
  });
});

await this.activityService.logActivity(
  requesterId,
  groupId,
  ActivityAction.SETTLEMENT_CREATED,
  `Recorded settlement of ₹${(settlement.amountPaise / 100).toFixed(2)}`,
  {
    settlementId: settlement.id,
    amountPaise: settlement.amountPaise,
    receiverId: dto.receiverId,
  },
);
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

return settlement;
  }
  async getGroupSettlements(
  groupId: string,
  requesterId: string,
) {
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
      'You must be a group member to view settlements',
    );
  }

  return this.prisma.settlement.findMany({
    where: { groupId },
    orderBy: { settledAt: 'desc' },
    include: {
      payer: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      receiver: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
}
  async getMySettlements(requesterId: string) {
  return this.prisma.settlement.findMany({
    where: {
      OR: [
        { payerId: requesterId },
        { receiverId: requesterId },
      ],
    },
    orderBy: {
      settledAt: 'desc',
    },
    include: {
      group: {
        select: {
          id: true,
          name: true,
        },
      },
      payer: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      receiver: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
}
}
