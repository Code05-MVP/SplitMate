import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { PrismaService } from '../prisma/prisma.service';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  namespace: '/realtime',
  cors: {
    origin: 'http://localhost:5173',
    credentials: true,
  },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
  private readonly jwtService: JwtService,
  private readonly prisma: PrismaService,
) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token;

      if (typeof token !== 'string' || !token) {
        throw new UnauthorizedException('Access token is required');
      }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_ACCESS_SECRET,
      });

     
if (typeof payload.sub !== 'string' || !payload.sub) {
  throw new UnauthorizedException('Invalid access token');
}

client.data.userId = payload.sub;


      console.log(`Authenticated socket connected: ${client.id}`);
    } catch {
      client.disconnect(true);
    }
  }
  
  @SubscribeMessage('group:join')
async handleJoinGroup(
  @ConnectedSocket() client: Socket,
  @MessageBody() data: { groupId: string },
  ) 
  {
    const { groupId } = data ?? {};
    const userId = client.data.userId;

    if (typeof userId !== 'string' || !groupId) {
      client.emit('group:error', {
        message: 'Authentication and group ID are required.',
      });
      return;
    }

    const membership = await this.prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId,
        },
      },
      select: { id: true },
    });

    if (!membership) {
      client.emit('group:error', {
        message: 'You are not a member of this group.',
      });
      return;
    }

    await client.join(`group:${groupId}`);

    client.emit('group:joined', { groupId });
  }
  broadcastToGroup(
  groupId: string,
  event: string,
  data: unknown,
) {
  this.server
    .to(`group:${groupId}`)
    .emit(event, data);
}


  handleDisconnect(client: Socket) {
    console.log(`Socket disconnected: ${client.id}`);
  }
}
