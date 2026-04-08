import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WsHub } from '../ws/ws.hub';
import { PushService } from '../push/push.service';

@Injectable()
export class ChatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hub: WsHub,
    private readonly push: PushService,
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
    return member;
  }

  async assertAdmin(chatId: string, userId: string) {
    const member = await this.assertMember(chatId, userId);
    if (member.role !== 'admin') throw new ForbiddenException('Admin only');
    return member;
  }

  async getChat(chatId: string, userId: string) {
    await this.assertMember(chatId, userId);
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: {
        members: {
          include: { user: { select: { id: true, username: true, displayName: true } } },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });
    if (!chat) throw new NotFoundException('Chat not found');
    return this.serializeChat(chat, userId);
  }

  async createGroup(creatorId: string, title: string, memberUsernames: string[]) {
    const uniqueUsernames = Array.from(new Set(memberUsernames));
    const users = await this.prisma.user.findMany({
      where: { username: { in: uniqueUsernames }, isVerified: true },
      select: { id: true, username: true },
    });
    if (users.length === 0) throw new NotFoundException('No valid users found');

    const memberData = [
      { userId: creatorId, role: 'admin' },
      ...users.filter((u) => u.id !== creatorId).map((u) => ({ userId: u.id, role: 'member' })),
    ];

    const chat = await this.prisma.chat.create({
      data: {
        type: 'group',
        title,
        members: { create: memberData },
      },
      include: {
        members: { include: { user: { select: { id: true, username: true, displayName: true } } } },
      },
    });

    // Уведомляем всех участников, что у них новый чат
    this.hub.sendToUsers(
      memberData.map((m) => m.userId),
      { type: 'chat:updated', payload: { chatId: chat.id } },
    );

    return this.serializeChat(chat, creatorId);
  }

  async addMember(chatId: string, actorId: string, username: string) {
    const chat = await this.prisma.chat.findUnique({ where: { id: chatId } });
    if (!chat) throw new NotFoundException('Chat not found');
    if (chat.type === 'direct') throw new ForbiddenException('Cannot add members to direct chat');
    await this.assertAdmin(chatId, actorId);

    const user = await this.prisma.user.findUnique({ where: { username } });
    if (!user) throw new NotFoundException('User not found');

    const existing = await this.prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId: user.id } },
    });
    if (existing) throw new ForbiddenException('Already a member');

    await this.prisma.chatMember.create({
      data: { chatId, userId: user.id, role: 'member' },
    });

    const members = await this.prisma.chatMember.findMany({ where: { chatId }, select: { userId: true } });
    this.hub.sendToUsers(
      members.map((m) => m.userId),
      { type: 'chat:updated', payload: { chatId } },
    );

    return this.getChat(chatId, actorId);
  }

  async removeMember(chatId: string, actorId: string, targetUserId: string) {
    const chat = await this.prisma.chat.findUnique({ where: { id: chatId } });
    if (!chat) throw new NotFoundException('Chat not found');
    if (chat.type === 'direct') throw new ForbiddenException('Cannot remove members from direct chat');

    // Сам себя выйти может любой; других — только админ
    if (targetUserId !== actorId) {
      await this.assertAdmin(chatId, actorId);
    } else {
      await this.assertMember(chatId, actorId);
    }

    const target = await this.prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId: targetUserId } },
    });
    if (!target) throw new NotFoundException('Member not found');

    // Запрашиваем список всех участников ДО удаления (чтобы вышедший тоже получил уведомление)
    const members = await this.prisma.chatMember.findMany({ where: { chatId }, select: { userId: true } });

    await this.prisma.chatMember.delete({ where: { id: target.id } });

    this.hub.sendToUsers(
      members.map((m) => m.userId),
      { type: 'chat:updated', payload: { chatId } },
    );

    return { ok: true };
  }

  async updateChat(chatId: string, actorId: string, title: string) {
    const chat = await this.prisma.chat.findUnique({ where: { id: chatId } });
    if (!chat) throw new NotFoundException('Chat not found');
    if (chat.type === 'direct') throw new ForbiddenException('Cannot rename direct chat');
    await this.assertAdmin(chatId, actorId);

    await this.prisma.chat.update({ where: { id: chatId }, data: { title } });

    const members = await this.prisma.chatMember.findMany({ where: { chatId }, select: { userId: true } });
    this.hub.sendToUsers(
      members.map((m) => m.userId),
      { type: 'chat:updated', payload: { chatId } },
    );

    return this.getChat(chatId, actorId);
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

  async sendMessage(
    chatId: string,
    userId: string,
    payload: { content?: string; mediaKey?: string; mediaType?: string; mediaName?: string; mediaSize?: number },
  ) {
    await this.assertMember(chatId, userId);
    if (!payload.content && !payload.mediaKey) {
      throw new ForbiddenException('Empty message');
    }

    const message = await this.prisma.message.create({
      data: {
        chatId,
        senderId: userId,
        content: payload.content ?? '',
        mediaKey: payload.mediaKey,
        mediaType: payload.mediaType,
        mediaName: payload.mediaName,
        mediaSize: payload.mediaSize,
      },
    });

    // Рассылаем всем участникам чата через WS
    const members = await this.prisma.chatMember.findMany({
      where: { chatId },
      select: { userId: true },
    });
    const memberIds = members.map((m) => m.userId);
    this.hub.sendToUsers(memberIds, { type: 'message:new', payload: message });

    // Push всем кроме отправителя
    const recipientIds = memberIds.filter((id) => id !== userId);
    if (recipientIds.length > 0) {
      const sender = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { displayName: true },
      });
      const chat = await this.prisma.chat.findUnique({
        where: { id: chatId },
        select: { type: true, title: true },
      });
      const title = chat?.type === 'direct' ? sender?.displayName ?? 'New message' : chat?.title ?? 'New message';
      const body = payload.content || (payload.mediaType?.startsWith('image/') ? '📷 Фото' : payload.mediaKey ? '📄 Файл' : '');
      this.push
        .sendToUsers(recipientIds, {
          title,
          body,
          data: { chatId, messageId: message.id },
        })
        .catch(() => undefined);
    }

    return message;
  }

  private serializeChat(
    chat: {
      id: string;
      type: string;
      title: string | null;
      createdAt: Date;
      members: Array<{ role?: string; user: { id: string; username: string; displayName: string } }>;
    },
    viewerId: string,
  ) {
    let title = chat.title;
    if (chat.type === 'direct') {
      const other = chat.members.find((m) => m.user.id !== viewerId);
      title = other?.user.displayName ?? 'Chat';
    }
    const viewerRole = chat.members.find((m) => m.user.id === viewerId)?.role ?? 'member';
    return {
      id: chat.id,
      type: chat.type,
      title,
      createdAt: chat.createdAt,
      viewerRole,
      members: chat.members.map((m) => ({ ...m.user, role: m.role ?? 'member' })),
    };
  }
}
