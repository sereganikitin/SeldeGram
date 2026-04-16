import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { IncomingMessage } from 'http';
import { Server, WebSocket } from 'ws';
import { WsHub } from './ws.hub';
import { PrismaService } from '../prisma/prisma.service';

interface AuthedSocket extends WebSocket {
  userId?: string;
}

@WebSocketGateway({ path: '/ws' })
export class WsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(WsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly hub: WsHub,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: AuthedSocket, req: IncomingMessage) {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const token = url.searchParams.get('token');
      if (!token) throw new Error('no token');
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token);
      client.userId = payload.sub;
      this.hub.add(payload.sub, client);
      this.logger.log(`WS connected: user=${client.userId}`);

      // Отмечаем онлайн
      await this.prisma.user.update({
        where: { id: payload.sub },
        data: { isOnline: true, lastSeenAt: new Date() },
      }).catch(() => undefined);

      // Уведомляем контакты
      this.broadcastPresence(payload.sub, true);

      client.send(JSON.stringify({ type: 'hello', userId: client.userId }));
    } catch (e) {
      this.logger.warn(`WS auth failed: ${(e as Error).message}`);
      client.close(4001, 'unauthorized');
    }
  }

  async handleDisconnect(client: AuthedSocket) {
    if (client.userId) {
      this.hub.remove(client.userId, client);

      // Если больше нет активных соединений — офлайн
      const stillConnected = this.hub.isConnected(client.userId);
      if (!stillConnected) {
        await this.prisma.user.update({
          where: { id: client.userId },
          data: { isOnline: false, lastSeenAt: new Date() },
        }).catch(() => undefined);
        this.broadcastPresence(client.userId, false);
      }
    }
    this.logger.log(`WS disconnected: user=${client.userId ?? 'anon'}`);
  }

  private async broadcastPresence(userId: string, online: boolean) {
    // Рассылаем статус всем участникам direct-чатов этого пользователя
    const chats = await this.prisma.chatMember.findMany({
      where: { userId },
      select: { chatId: true },
    });
    const chatIds = chats.map((c) => c.chatId);
    if (chatIds.length === 0) return;
    const peers = await this.prisma.chatMember.findMany({
      where: { chatId: { in: chatIds }, userId: { not: userId } },
      select: { userId: true },
    });
    const peerIds = [...new Set(peers.map((p) => p.userId))];
    this.hub.sendToUsers(peerIds, {
      type: 'presence',
      payload: { userId, online, lastSeenAt: new Date().toISOString() },
    });
  }

  @SubscribeMessage('ping')
  onPing(@ConnectedSocket() client: AuthedSocket, @MessageBody() data: unknown) {
    return { event: 'pong', data: { echo: data, userId: client.userId } };
  }

  @SubscribeMessage('call:signal')
  onCallSignal(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody()
    data: { to: string; callId: string; kind: 'offer' | 'answer' | 'ice'; data: unknown },
  ) {
    if (!client.userId || !data?.to || !data?.callId || !data?.kind) return;
    this.hub.sendToUser(data.to, {
      type: 'call:signal',
      payload: {
        from: client.userId,
        callId: data.callId,
        kind: data.kind,
        data: data.data,
      },
    });
  }
}
