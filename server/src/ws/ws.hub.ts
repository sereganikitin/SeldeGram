import { Injectable, Logger } from '@nestjs/common';
import { WebSocket } from 'ws';

@Injectable()
export class WsHub {
  private readonly logger = new Logger(WsHub.name);
  private readonly sockets = new Map<string, Set<WebSocket>>();

  add(userId: string, socket: WebSocket) {
    let set = this.sockets.get(userId);
    if (!set) {
      set = new Set();
      this.sockets.set(userId, set);
    }
    set.add(socket);
  }

  remove(userId: string, socket: WebSocket) {
    const set = this.sockets.get(userId);
    if (!set) return;
    set.delete(socket);
    if (set.size === 0) this.sockets.delete(userId);
  }

  sendToUser(userId: string, payload: unknown) {
    const set = this.sockets.get(userId);
    if (!set) return;
    const data = JSON.stringify(payload);
    for (const socket of set) {
      if (socket.readyState === socket.OPEN) {
        socket.send(data);
      }
    }
  }

  sendToUsers(userIds: string[], payload: unknown) {
    for (const id of userIds) this.sendToUser(id, payload);
  }

  isConnected(userId: string): boolean {
    const set = this.sockets.get(userId);
    return !!set && set.size > 0;
  }
}
