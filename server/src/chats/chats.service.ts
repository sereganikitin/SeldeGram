import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WsHub } from '../ws/ws.hub';
import { PushService } from '../push/push.service';
import { StickersService } from '../stickers/stickers.service';

const messageInclude = {
  replyTo: {
    select: {
      id: true,
      senderId: true,
      content: true,
      mediaType: true,
      mediaKey: true,
      deletedAt: true,
    },
  },
} as const;

@Injectable()
export class ChatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hub: WsHub,
    private readonly push: PushService,
    private readonly stickers: StickersService,
  ) {}

  async createDirect(userId: string, otherUsername: string) {
    const other = await this.prisma.user.findUnique({ where: { username: otherUsername } });
    if (!other) throw new NotFoundException('User not found');
    if (other.id === userId) throw new ForbiddenException('Cannot chat with yourself');

    const existing = await this.prisma.chat.findFirst({
      where: {
        type: 'direct',
        AND: [
          { members: { some: { userId } } },
          { members: { some: { userId: other.id } } },
        ],
      },
      include: { members: { include: { user: { select: { id: true, username: true, displayName: true, avatarKey: true } } } } },
    });
    if (existing) return this.serializeChat(existing, userId);

    const chat = await this.prisma.chat.create({
      data: {
        type: 'direct',
        members: { create: [{ userId }, { userId: other.id }] },
      },
      include: { members: { include: { user: { select: { id: true, username: true, displayName: true, avatarKey: true } } } } },
    });
    this.hub.sendToUsers([userId, other.id], { type: 'chat:updated', payload: { chatId: chat.id } });
    return this.serializeChat(chat, userId);
  }

  async listForUser(userId: string) {
    const chats = await this.prisma.chat.findMany({
      where: { members: { some: { userId } } },
      include: {
        members: { include: { user: { select: { id: true, username: true, displayName: true, avatarKey: true } } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        reads: { where: { userId } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // unread count для каждого чата
    const result = await Promise.all(
      chats.map(async (c) => {
        const lastRead = c.reads[0]?.lastReadAt ?? new Date(0);
        const unreadCount = await this.prisma.message.count({
          where: {
            chatId: c.id,
            createdAt: { gt: lastRead },
            senderId: { not: userId },
            deletedAt: null,
          },
        });
        return {
          ...this.serializeChat(c, userId),
          lastMessage: c.messages[0] ?? null,
          unreadCount,
        };
      }),
    );
    // сортируем: чаты с lastMessage по дате, без него — по createdAt
    result.sort((a, b) => {
      const at = (a.lastMessage?.createdAt ?? a.createdAt) as Date;
      const bt = (b.lastMessage?.createdAt ?? b.createdAt) as Date;
      return new Date(bt).getTime() - new Date(at).getTime();
    });
    return result;
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
          include: { user: { select: { id: true, username: true, displayName: true, avatarKey: true } } },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });
    if (!chat) throw new NotFoundException('Chat not found');
    return this.serializeChat(chat, userId);
  }

  async createChannel(creatorId: string, title: string, slug: string) {
    const slugLower = slug.toLowerCase();
    const existing = await this.prisma.chat.findUnique({ where: { slug: slugLower } });
    if (existing) throw new ForbiddenException('Slug already taken');

    const chat = await this.prisma.chat.create({
      data: {
        type: 'channel',
        title,
        slug: slugLower,
        members: { create: [{ userId: creatorId, role: 'admin' }] },
      },
      include: {
        members: { include: { user: { select: { id: true, username: true, displayName: true, avatarKey: true } } } },
      },
    });
    this.hub.sendToUsers([creatorId], { type: 'chat:updated', payload: { chatId: chat.id } });
    return this.serializeChat(chat, creatorId);
  }

  async joinChannel(userId: string, slug: string) {
    const chat = await this.prisma.chat.findUnique({
      where: { slug: slug.toLowerCase() },
      include: {
        members: { include: { user: { select: { id: true, username: true, displayName: true, avatarKey: true } } } },
      },
    });
    if (!chat || chat.type !== 'channel') throw new NotFoundException('Channel not found');

    const existing = await this.prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId: chat.id, userId } },
    });
    if (!existing) {
      await this.prisma.chatMember.create({ data: { chatId: chat.id, userId, role: 'member' } });
    }

    const updated = await this.prisma.chat.findUnique({
      where: { id: chat.id },
      include: {
        members: { include: { user: { select: { id: true, username: true, displayName: true, avatarKey: true } } } },
      },
    });
    this.hub.sendToUsers([userId], { type: 'chat:updated', payload: { chatId: chat.id } });
    return this.serializeChat(updated!, userId);
  }

  async searchChannels(query: string) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const chats = await this.prisma.chat.findMany({
      where: {
        type: 'channel',
        OR: [
          { slug: { contains: q } },
          { title: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: { _count: { select: { members: true } } },
      take: 20,
    });
    return chats.map((c) => ({
      id: c.id,
      title: c.title,
      slug: c.slug,
      memberCount: c._count.members,
    }));
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
      data: { type: 'group', title, members: { create: memberData } },
      include: { members: { include: { user: { select: { id: true, username: true, displayName: true, avatarKey: true } } } } },
    });

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

    await this.prisma.chatMember.create({ data: { chatId, userId: user.id, role: 'member' } });
    const members = await this.prisma.chatMember.findMany({ where: { chatId }, select: { userId: true } });
    this.hub.sendToUsers(members.map((m) => m.userId), { type: 'chat:updated', payload: { chatId } });
    return this.getChat(chatId, actorId);
  }

  async removeMember(chatId: string, actorId: string, targetUserId: string) {
    const chat = await this.prisma.chat.findUnique({ where: { id: chatId } });
    if (!chat) throw new NotFoundException('Chat not found');
    if (chat.type === 'direct') throw new ForbiddenException('Cannot remove members from direct chat');

    if (targetUserId !== actorId) {
      await this.assertAdmin(chatId, actorId);
    } else {
      await this.assertMember(chatId, actorId);
    }
    const target = await this.prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId: targetUserId } },
    });
    if (!target) throw new NotFoundException('Member not found');

    const members = await this.prisma.chatMember.findMany({ where: { chatId }, select: { userId: true } });
    await this.prisma.chatMember.delete({ where: { id: target.id } });
    this.hub.sendToUsers(members.map((m) => m.userId), { type: 'chat:updated', payload: { chatId } });
    return { ok: true };
  }

  async updateChat(chatId: string, actorId: string, title: string) {
    const chat = await this.prisma.chat.findUnique({ where: { id: chatId } });
    if (!chat) throw new NotFoundException('Chat not found');
    if (chat.type === 'direct') throw new ForbiddenException('Cannot rename direct chat');
    await this.assertAdmin(chatId, actorId);

    await this.prisma.chat.update({ where: { id: chatId }, data: { title } });
    const members = await this.prisma.chatMember.findMany({ where: { chatId }, select: { userId: true } });
    this.hub.sendToUsers(members.map((m) => m.userId), { type: 'chat:updated', payload: { chatId } });
    return this.getChat(chatId, actorId);
  }

  // Удалить чат целиком (для direct — для обоих)
  async deleteChat(chatId: string, actorId: string) {
    await this.assertMember(chatId, actorId);
    const members = await this.prisma.chatMember.findMany({ where: { chatId }, select: { userId: true } });
    await this.prisma.chat.delete({ where: { id: chatId } });
    this.hub.sendToUsers(members.map((m) => m.userId), { type: 'chat:deleted', payload: { chatId } });
    return { ok: true };
  }

  async listMessages(chatId: string, userId: string, before: string | undefined, limit: number) {
    await this.assertMember(chatId, userId);
    const messages = await this.prisma.message.findMany({
      where: { chatId, ...(before ? { createdAt: { lt: new Date(before) } } : {}) },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
      include: messageInclude,
    });
    return messages.reverse();
  }

  async sendMessage(
    chatId: string,
    userId: string,
    payload: {
      content?: string;
      mediaKey?: string;
      mediaType?: string;
      mediaName?: string;
      mediaSize?: number;
      replyToId?: string;
      forwardedFromId?: string;
      stickerId?: string;
    },
  ) {
    const member = await this.assertMember(chatId, userId);
    const chatRow = await this.prisma.chat.findUnique({ where: { id: chatId }, select: { type: true } });
    if (chatRow?.type === 'channel' && member.role !== 'admin') {
      throw new ForbiddenException('Only admins can post to channel');
    }
    if (!payload.content && !payload.mediaKey && !payload.forwardedFromId && !payload.stickerId) {
      throw new ForbiddenException('Empty message');
    }

    // Если форвард — копируем содержимое исходного сообщения, чтобы в чате-получателе оно отображалось
    let copiedContent = payload.content ?? '';
    let copiedMediaKey = payload.mediaKey;
    let copiedMediaType = payload.mediaType;
    let copiedMediaName = payload.mediaName;
    let copiedMediaSize = payload.mediaSize;
    let isSticker = false;

    // Если стикер — берём mediaKey из БД
    if (payload.stickerId) {
      const sticker = await this.prisma.sticker.findUnique({ where: { id: payload.stickerId } });
      if (!sticker) throw new NotFoundException('Sticker not found');
      copiedMediaKey = sticker.mediaKey;
      copiedMediaType = 'image/webp';
      copiedContent = sticker.emoji;
      isSticker = true;
      this.stickers.markUsed(userId, sticker.id).catch(() => undefined);
    }

    if (payload.forwardedFromId) {
      const src = await this.prisma.message.findUnique({ where: { id: payload.forwardedFromId } });
      if (!src || src.deletedAt) throw new NotFoundException('Source message not found');
      // Можно ли видеть исходное сообщение?
      await this.assertMember(src.chatId, userId);
      copiedContent = src.content;
      copiedMediaKey = src.mediaKey ?? undefined;
      copiedMediaType = src.mediaType ?? undefined;
      copiedMediaName = src.mediaName ?? undefined;
      copiedMediaSize = src.mediaSize ?? undefined;
    }

    if (payload.replyToId) {
      const reply = await this.prisma.message.findUnique({ where: { id: payload.replyToId } });
      if (!reply || reply.chatId !== chatId) {
        throw new NotFoundException('Reply target not found');
      }
    }

    const message = await this.prisma.message.create({
      data: {
        chatId,
        senderId: userId,
        content: copiedContent,
        mediaKey: copiedMediaKey,
        mediaType: copiedMediaType,
        mediaName: copiedMediaName,
        mediaSize: copiedMediaSize,
        isSticker,
        replyToId: payload.replyToId,
        forwardedFromId: payload.forwardedFromId,
      },
      include: messageInclude,
    });

    const members = await this.prisma.chatMember.findMany({ where: { chatId }, select: { userId: true } });
    const memberIds = members.map((m) => m.userId);
    this.hub.sendToUsers(memberIds, { type: 'message:new', payload: message });

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
      const body = message.isSticker
        ? `${message.content} Стикер`
        : message.content || (message.mediaType?.startsWith('image/') ? '📷 Фото' : message.mediaKey ? '📄 Файл' : '');
      this.push
        .sendToUsers(recipientIds, { title, body, data: { chatId, messageId: message.id } })
        .catch(() => undefined);
    }

    return message;
  }

  async editMessage(chatId: string, userId: string, messageId: string, content: string) {
    await this.assertMember(chatId, userId);
    const msg = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!msg || msg.chatId !== chatId) throw new NotFoundException('Message not found');
    if (msg.senderId !== userId) throw new ForbiddenException('Not your message');
    if (msg.deletedAt) throw new ForbiddenException('Already deleted');

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: { content, editedAt: new Date() },
      include: messageInclude,
    });

    const members = await this.prisma.chatMember.findMany({ where: { chatId }, select: { userId: true } });
    this.hub.sendToUsers(members.map((m) => m.userId), { type: 'message:edited', payload: updated });
    return updated;
  }

  async deleteMessage(chatId: string, userId: string, messageId: string) {
    await this.assertMember(chatId, userId);
    const msg = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!msg || msg.chatId !== chatId) throw new NotFoundException('Message not found');
    if (msg.senderId !== userId) throw new ForbiddenException('Not your message');

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: { content: '', mediaKey: null, mediaType: null, mediaName: null, mediaSize: null, deletedAt: new Date() },
      include: messageInclude,
    });

    const members = await this.prisma.chatMember.findMany({ where: { chatId }, select: { userId: true } });
    this.hub.sendToUsers(members.map((m) => m.userId), { type: 'message:deleted', payload: { chatId, messageId } });
    return updated;
  }

  async markRead(chatId: string, userId: string, messageId: string) {
    await this.assertMember(chatId, userId);
    const msg = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!msg || msg.chatId !== chatId) throw new NotFoundException('Message not found');

    await this.prisma.chatRead.upsert({
      where: { chatId_userId: { chatId, userId } },
      create: { chatId, userId, lastReadAt: msg.createdAt },
      update: { lastReadAt: msg.createdAt },
    });

    // Уведомляем других участников, что мы прочитали (для галочек)
    const members = await this.prisma.chatMember.findMany({ where: { chatId }, select: { userId: true } });
    this.hub.sendToUsers(
      members.map((m) => m.userId),
      { type: 'chat:read', payload: { chatId, userId, lastReadAt: msg.createdAt } },
    );
    return { ok: true };
  }

  async typing(chatId: string, userId: string) {
    await this.assertMember(chatId, userId);
    const members = await this.prisma.chatMember.findMany({ where: { chatId }, select: { userId: true } });
    this.hub.sendToUsers(
      members.map((m) => m.userId).filter((id) => id !== userId),
      { type: 'chat:typing', payload: { chatId, userId } },
    );
    return { ok: true };
  }

  async getChatReads(chatId: string, userId: string) {
    await this.assertMember(chatId, userId);
    const reads = await this.prisma.chatRead.findMany({
      where: { chatId },
      select: { userId: true, lastReadAt: true },
    });
    return reads;
  }

  private serializeChat(
    chat: {
      id: string;
      type: string;
      title: string | null;
      createdAt: Date;
      members: Array<{
        role?: string;
        wallpaper?: string | null;
        user: { id: string; username: string; displayName: string; avatarKey?: string | null };
      }>;
    },
    viewerId: string,
  ) {
    let title = chat.title;
    if (chat.type === 'direct') {
      const other = chat.members.find((m) => m.user.id !== viewerId);
      title = other?.user.displayName ?? 'Chat';
    }
    const viewerMember = chat.members.find((m) => m.user.id === viewerId);
    const viewerRole = viewerMember?.role ?? 'member';
    let visibleMembers = chat.members.map((m) => ({ ...m.user, role: m.role ?? 'member' }));
    if (chat.type === 'channel' && viewerRole !== 'admin') {
      visibleMembers = visibleMembers.filter((m) => m.id === viewerId);
    }
    return {
      id: chat.id,
      type: chat.type,
      title,
      slug: (chat as { slug?: string | null }).slug ?? null,
      createdAt: chat.createdAt,
      viewerRole,
      viewerWallpaper: viewerMember?.wallpaper ?? null,
      memberCount: chat.members.length,
      members: visibleMembers,
    };
  }

  async setWallpaper(chatId: string, userId: string, wallpaper: string | null) {
    const member = await this.assertMember(chatId, userId);
    await this.prisma.chatMember.update({
      where: { id: member.id },
      data: { wallpaper },
    });
    return { ok: true };
  }
}
