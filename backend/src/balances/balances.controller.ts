
import {
  Controller,
  Get,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BalancesService } from './balances.service';

@Controller('api/v1/groups/:groupId/balances')
@UseGuards(JwtAuthGuard)
export class BalancesController {
  constructor(
    private readonly balancesService: BalancesService,
  ) {}

  @Get()
  async getGroupBalances(
    @Param('groupId') groupId: string,
    @Req() req: { user: { userId: string } },
  ) {
    return this.balancesService.getGroupBalances(
      groupId,
      req.user.userId,
    );
  }
}
