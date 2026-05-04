import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CallKind, CallStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WsHub } from '../ws/ws.hub';
import { PushService } from '../push/push.service';

const PEER_SELECT = {
  id: true,
  username: true,
  displayName: true,
  avatarKey: true,
} as const;

@Injectable()
export class CallsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hub: WsHub,
    private readonly push: PushService,
  ) {}

  async initiate(callerId: string, calleeId: string, kind: CallKind = 'audio') {
    if (callerId === calleeId) {
      throw new BadRequestException('Cannot call yourself');
    }
    const callee = await this.prisma.user.findUnique({ where: { id: calleeId } });
    if (!callee) throw new NotFoundException('User not found');

    // Проверка блокировок в любую сторону
    const block = await this.prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: callerId, blockedId: calleeId },
          { blockerId: calleeId, blockedId: callerId },
        ],
      },
    });
    if (block) throw new ForbiddenException('Call not allowed');

    const call = await this.prisma.call.create({
      data: { callerId, calleeId, kind, status: 'ringing' },
      include: { caller: { select: PEER_SELECT }, callee: { select: PEER_SELECT } },
    });

    this.hub.sendToUser(calleeId, {
      type: 'call:incoming',
      payload: {
        callId: call.id,
        kind: call.kind,
        from: call.caller,
        startedAt: call.startedAt,
      },
    });

    // Если у callee нет активного WS-соединения — пушим уведомление, чтобы
    // звонок прорвался при закрытом / спящем приложении.
    if (!this.hub.isConnected(calleeId)) {
      const callerName = call.caller.displayName || call.caller.username;
      this.push.sendToUsers([calleeId], {
        title: callerName,
        body: kind === 'video' ? 'Видеозвонок' : 'Входящий звонок',
        data: {
          type: 'call',
          callId: call.id,
          kind: call.kind,
          from: call.caller,
        },
        channelId: 'calls',
        priority: 'high',
        ttl: 30, // если устройство офлайн больше 30 сек — звонок неактуален
      }).catch(() => undefined);
    }

    return call;
  }

  async accept(userId: string, callId: string) {
    const call = await this.prisma.call.findUnique({ where: { id: callId } });
    if (!call) throw new NotFoundException('Call not found');
    if (call.calleeId !== userId) throw new ForbiddenException();
    if (call.status !== 'ringing') throw new BadRequestException('Call already handled');

    const updated = await this.prisma.call.update({
      where: { id: callId },
      data: { status: 'accepted', acceptedAt: new Date() },
    });

    this.hub.sendToUser(call.callerId, {
      type: 'call:accepted',
      payload: { callId: call.id },
    });

    return updated;
  }

  async reject(userId: string, callId: string) {
    const call = await this.prisma.call.findUnique({ where: { id: callId } });
    if (!call) throw new NotFoundException('Call not found');
    if (call.calleeId !== userId) throw new ForbiddenException();
    if (call.status !== 'ringing') throw new BadRequestException('Call already handled');

    const updated = await this.prisma.call.update({
      where: { id: callId },
      data: { status: 'rejected', endedAt: new Date() },
    });

    this.hub.sendToUser(call.callerId, {
      type: 'call:rejected',
      payload: { callId: call.id },
    });

    return updated;
  }

  async end(userId: string, callId: string) {
    const call = await this.prisma.call.findUnique({ where: { id: callId } });
    if (!call) throw new NotFoundException('Call not found');
    if (call.callerId !== userId && call.calleeId !== userId) {
      throw new ForbiddenException();
    }
    if (call.status === 'ended' || call.status === 'rejected' || call.status === 'missed') {
      return call;
    }

    const now = new Date();
    let nextStatus: CallStatus = 'ended';
    let durationSec: number | null = null;

    if (call.status === 'ringing') {
      // Никто не принял — если отменил вызывающий, это missed для callee
      nextStatus = 'missed';
    } else if (call.acceptedAt) {
      durationSec = Math.max(0, Math.floor((now.getTime() - call.acceptedAt.getTime()) / 1000));
    }

    const updated = await this.prisma.call.update({
      where: { id: callId },
      data: { status: nextStatus, endedAt: now, durationSec },
    });

    const peerId = call.callerId === userId ? call.calleeId : call.callerId;
    this.hub.sendToUser(peerId, {
      type: 'call:ended',
      payload: { callId: call.id, status: nextStatus, durationSec },
    });

    return updated;
  }

  async history(userId: string, limit = 50, before?: string) {
    return this.prisma.call.findMany({
      where: { OR: [{ callerId: userId }, { calleeId: userId }] },
      include: {
        caller: { select: PEER_SELECT },
        callee: { select: PEER_SELECT },
      },
      orderBy: { startedAt: 'desc' },
      take: Math.min(limit, 100),
      ...(before ? { cursor: { id: before }, skip: 1 } : {}),
    });
  }
}
