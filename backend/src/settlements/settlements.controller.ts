
import {
  Body,
  Controller,
  Param,
  Post,
  Get,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateSettlementDto } from './create-settlement.dto';
import { SettlementsService } from './settlements.service';

@Controller('api/v1')
@UseGuards(JwtAuthGuard)
export class SettlementsController {
  constructor(
    private readonly settlementsService: SettlementsService,
  ) {}

  @Post('groups/:groupId/settlements')
  async createSettlement(
    @Param('groupId') groupId: string,
    @Body() dto: CreateSettlementDto,
    @Req() req: { user: { userId: string } },
  ) {
    return this.settlementsService.createSettlement(
      groupId,
      req.user.userId,
      dto,
    );
  }

  @Get('groups/:groupId/settlements')
  async getGroupSettlements(
    @Param('groupId') groupId: string,
    @Req() req: { user: { userId: string } },
  ) {
    return this.settlementsService.getGroupSettlements(
      groupId,
      req.user.userId,
    );
  }

  @Get('settlements/my')
  async getMySettlements(
    @Req() req: { user: { userId: string } },
  ) {
    return this.settlementsService.getMySettlements(
      req.user.userId,
    );
  }
}
