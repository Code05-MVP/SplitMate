import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AddGroupMemberDto } from './add-group-member.dto';
import { CreateGroupDto } from './create-group.dto';
import { GroupsService } from './groups.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/v1/groups')
@UseGuards(JwtAuthGuard)
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}
  
@Get(':groupId/balances')
async getGroupBalances(
  @Param('groupId') groupId: string,
  @Req() req: { user: { userId: string } },
) {
  return this.groupsService.getGroupBalances(
    groupId,
    req.user.userId,
  );
}


 @Post()
async createGroup(
  @Body() body: CreateGroupDto,
  @Req() req: { user: { userId: string } },
) {
  return this.groupsService.createGroup(
    body.name,
    req.user.userId,
    body.description,
  );
}
  
@Get()
async getMyGroups(
  @Req() req: { user: { userId: string } },
) {
  return this.groupsService.getMyGroups(req.user.userId);
}

@Post(':groupId/members')
async addGroupMember(
  @Param('groupId') groupId: string,
  @Body() body: AddGroupMemberDto,
  @Req() req: { user: { userId: string } },
) {
  return this.groupsService.addGroupMember(
    groupId,
    req.user.userId,
    body.email,
  );
}

@Delete(':groupId/members/:memberId')
async removeGroupMember(
  @Param('groupId') groupId: string,
  @Param('memberId') memberId: string,
  @Req() req: { user: { userId: string } },
) {
  return this.groupsService.removeGroupMember(
    groupId,
    memberId,
    req.user.userId,
  );
}

@Delete(':groupId')
async deleteGroup(
  @Param('groupId') groupId: string,
  @Req() req: { user: { userId: string } },
) {
  return this.groupsService.deleteGroup(
    groupId,
    req.user.userId,
  );
}




}

