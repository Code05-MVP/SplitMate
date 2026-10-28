
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityAction } from '../../generated/prisma/client';

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async logActivity(
    actorId: string | null,
    groupId: string,
    action: ActivityAction,
    description: string,
    metadata?: object,
  ) {
    return this.prisma.activityLog.create({
      data: {
        actorId,
        groupId,
        action,
        details: {
          description,
          ...(metadata ?? {}),
        },
      },
    });
  }

  async getGroupActivity(
    groupId: string,
    page = 1,
    limit = 20,
  ) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));

    return this.prisma.activityLog.findMany({
      where: { groupId },
      orderBy: { createdAt: 'desc' },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
      include: {
        actor: {
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
