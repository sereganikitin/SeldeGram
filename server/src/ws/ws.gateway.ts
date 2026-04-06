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

interface AuthedSocket extends WebSocket {
  userId?: string;
}

@WebSocketGateway({ path: '/ws' })
export class WsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(WsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly jwt: JwtService) {}

  async handleConnection(client: AuthedSocket, req: IncomingMessage) {
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const token = url.searchParams.get('token');
      if (!token) throw new Error('no token');
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token);
      client.userId = payload.sub;
      this.logger.log(`WS connected: user=${client.userId}`);
      client.send(JSON.stringify({ type: 'hello', userId: client.userId }));
    } catch (e) {
      this.logger.warn(`WS auth failed: ${(e as Error).message}`);
      client.close(4001, 'unauthorized');
    }
  }

  handleDisconnect(client: AuthedSocket) {
    this.logger.log(`WS disconnected: user=${client.userId ?? 'anon'}`);
  }

  @SubscribeMessage('ping')
  onPing(@ConnectedSocket() client: AuthedSocket, @MessageBody() data: unknown) {
    return { event: 'pong', data: { echo: data, userId: client.userId } };
  }
}
