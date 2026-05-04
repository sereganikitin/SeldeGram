import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channelId?: string;
  priority?: 'default' | 'normal' | 'high';
  ttl?: number; // секунды
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(private readonly prisma: PrismaService) {}

  async registerToken(userId: string, token: string, deviceName: string) {
    if (!token.startsWith('ExponentPushToken[') && !token.startsWith('ExpoPushToken[')) {
      throw new Error('Invalid Expo push token');
    }

    // Если этот токен уже привязан к другому пользователю — переносим на нового
    const existing = await this.prisma.device.findUnique({ where: { pushToken: token } });
    if (existing) {
      if (existing.userId === userId) return existing;
      await this.prisma.device.update({
        where: { id: existing.id },
        data: { userId, name: deviceName, lastSeenAt: new Date() },
      });
      return existing;
    }

    return this.prisma.device.create({
      data: { userId, name: deviceName, pushToken: token },
    });
  }

  async sendToUsers(userIds: string[], payload: PushPayload) {
    if (userIds.length === 0) return;
    const devices = await this.prisma.device.findMany({
      where: { userId: { in: userIds }, pushToken: { not: null } },
      select: { pushToken: true },
    });
    const tokens = devices.map((d) => d.pushToken!).filter(Boolean);
    if (tokens.length === 0) return;

    const messages = tokens.map((to) => ({
      to,
      sound: 'default',
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
      ...(payload.channelId ? { channelId: payload.channelId } : {}),
      ...(payload.priority ? { priority: payload.priority } : {}),
      ...(payload.ttl != null ? { ttl: payload.ttl } : {}),
    }));

    try {
      const resp = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });
      if (!resp.ok) {
        this.logger.warn(`Expo push failed: ${resp.status} ${await resp.text()}`);
        return;
      }
      const result = await resp.json();
      // Чистим невалидные токены (DeviceNotRegistered)
      if (result?.data && Array.isArray(result.data)) {
        for (let i = 0; i < result.data.length; i++) {
          const r = result.data[i];
          if (r?.status === 'error' && r?.details?.error === 'DeviceNotRegistered') {
            await this.prisma.device.updateMany({
              where: { pushToken: tokens[i] },
              data: { pushToken: null },
            });
          }
        }
      }
    } catch (e) {
      this.logger.warn(`Expo push error: ${(e as Error).message}`);
    }
  }
}
