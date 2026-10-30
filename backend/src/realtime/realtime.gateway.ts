
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';

import { UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { Namespace, Socket } from 'socket.io';

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
server: Namespace;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  // Authenticate every incoming socket connection
  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token;

      if (typeof token !== 'string' || !token) {
        throw new UnauthorizedException(
          'Access token is required',
        );
      }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_ACCESS_SECRET,
      });

      if (typeof payload.sub !== 'string' || !payload.sub) {
        throw new UnauthorizedException('Invalid access token');
      }

      client.data.userId = payload.sub;

      const expiresAt = payload.exp;

      if (typeof expiresAt !== 'number') {
        throw new UnauthorizedException(
          'Token expiry is missing',
        );
      }

      const remainingTime = expiresAt * 1000 - Date.now();

      if (remainingTime <= 0) {
        throw new UnauthorizedException(
          'Access token has expired',
        );
      }

      // Disconnect socket when its access token expires
      client.data.tokenExpiryTimer = setTimeout(() => {
        client.disconnect(true);
      }, remainingTime);

      console.log(
        `Authenticated socket connected: ${client.id}`,
      );
    } catch (error) {
      console.error(
        `[Socket] Authentication failed for ${client.id}:`,
        error instanceof Error ? error.message : error,
      );

      client.disconnect(true);
    }
  }

  // Allow authenticated group members to join their group room
  @SubscribeMessage('group:join')
  async handleJoinGroup(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { groupId?: string },
  ) {
    const userId = client.data.userId;
    const groupId = data?.groupId;

    if (
      typeof userId !== 'string' ||
      typeof groupId !== 'string' ||
      !groupId.trim()
    ) {
      client.emit('group:error', {
        message: 'Authentication and a valid group ID are required.',
      });
      return;
    }

    try {
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

      const room = `group:${groupId}`;

      await client.join(room);

      const roomSize = client.nsp.adapter.rooms.get(room)?.size ?? 0;

      console.log(
        `[Socket] ${client.id} joined ${room}`,
      );
      console.log(`[Socket] Room members: ${roomSize}`);

      client.emit('group:joined', { groupId });
    } catch (error) {
      console.error('[Socket] Group join failed:', error);

      client.emit('group:error', {
        message: 'Unable to join this group right now.',
      });
    }
  }

  // Broadcast an event to every connected member of a group room
  // Broadcast an event to every connected member of a group room
broadcastToGroup(
  groupId: string,
  event: string,
  data: unknown,
) {
  const room = `group:${groupId}`;

  const roomSize =
    this.server.adapter.rooms.get(room)?.size ?? 0;

  console.log(
    `[Socket] Broadcasting ${event} to ${room}`,
  );
  console.log(`[Socket] Room members: ${roomSize}`);

  this.server.to(room).emit(event, data);
}

  // Clear token-expiry timer when a socket disconnects
  handleDisconnect(client: Socket) {
    const timer = client.data.tokenExpiryTimer as
      | ReturnType<typeof setTimeout>
      | undefined;

    if (timer) {
      clearTimeout(timer);
    }

    console.log(`Socket disconnected: ${client.id}`);
  }
}
