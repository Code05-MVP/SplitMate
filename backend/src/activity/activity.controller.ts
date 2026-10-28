
import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from './activity.service';

@Controller('api/v1/groups/:groupId/activity')
@UseGuards(JwtAuthGuard)
export class ActivityController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityService: ActivityService,
  ) {}

  @Get()
  async getGroupActivity(
    @Param('groupId') groupId: string,
    @Req() req: { user: { userId: string } },
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const membership = await this.prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId: req.user.userId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException(
        'You must be a group member to view group activity',
      );
    }

    return this.activityService.getGroupActivity(
      groupId,
      Number(page),
      Number(limit),
    );
  }
}
