import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WsHub } from '../ws/ws.hub';

@Injectable()
export class ChatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hub: WsHub,
  ) {}

  async createDirect(userId: string, otherUsername: string) {
    const other = await this.prisma.user.findUnique({ where: { username: otherUsername } });
    if (!other) throw new NotFoundException('User not found');
    if (other.id === userId) throw new ForbiddenException('Cannot chat with yourself');

    // Ищем существующий direct-чат между этими двумя
    const existing = await this.prisma.chat.findFirst({
      where: {
        type: 'direct',
        AND: [
          { members: { some: { userId } } },
          { members: { some: { userId: other.id } } },
        ],
      },
      include: { members: { include: { user: { select: { id: true, username: true, displayName: true } } } } },
    });
    if (existing) return this.serializeChat(existing, userId);

    const chat = await this.prisma.chat.create({
      data: {
        type: 'direct',
        members: {
          create: [{ userId }, { userId: other.id }],
        },
      },
      include: { members: { include: { user: { select: { id: true, username: true, displayName: true } } } } },
    });
    return this.serializeChat(chat, userId);
  }

  async listForUser(userId: string) {
    const chats = await this.prisma.chat.findMany({
      where: { members: { some: { userId } } },
      include: {
        members: { include: { user: { select: { id: true, username: true, displayName: true } } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
    });
    return chats.map((c) => ({
      ...this.serializeChat(c, userId),
      lastMessage: c.messages[0] ?? null,
    }));
  }

  async assertMember(chatId: string, userId: string) {
    const member = await this.prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId } },
    });
    if (!member) throw new ForbiddenException('Not a member of this chat');
  }

  async listMessages(chatId: string, userId: string, before: string | undefined, limit: number) {
    await this.assertMember(chatId, userId);
    const messages = await this.prisma.message.findMany({
      where: {
        chatId,
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
    });
    return messages.reverse();
  }

  async sendMessage(chatId: string, userId: string, content: string) {
    await this.assertMember(chatId, userId);

    const message = await this.prisma.message.create({
      data: { chatId, senderId: userId, content },
    });

    // Рассылаем всем участникам чата
    const members = await this.prisma.chatMember.findMany({
      where: { chatId },
      select: { userId: true },
    });
    this.hub.sendToUsers(
      members.map((m) => m.userId),
      { type: 'message:new', payload: message },
    );

    return message;
  }

  private serializeChat(
    chat: { id: string; type: string; title: string | null; createdAt: Date; members: Array<{ user: { id: string; username: string; displayName: string } }> },
    viewerId: string,
  ) {
    let title = chat.title;
    if (chat.type === 'direct') {
      const other = chat.members.find((m) => m.user.id !== viewerId);
      title = other?.user.displayName ?? 'Chat';
    }
    return {
      id: chat.id,
      type: chat.type,
      title,
      createdAt: chat.createdAt,
      members: chat.members.map((m) => m.user),
    };
  }
}
