import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WsHub } from '../ws/ws.hub';
import { PushService } from '../push/push.service';
import { StickersService } from '../stickers/stickers.service';
import { BlocksService } from '../blocks/blocks.service';

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
  reactions: {
    select: { emoji: true, userId: true },
  },
} as const;

@Injectable()
export class ChatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hub: WsHub,
    private readonly push: PushService,
    private readonly stickers: StickersService,
    private readonly blocks: BlocksService,
  ) {}

  async createDirect(userId: string, otherUsername: string) {
    const other = await this.prisma.user.findUnique({ where: { username: otherUsername } });
    if (!other) throw new NotFoundException('User not found');
    if (other.id === userId) throw new ForbiddenException('Cannot chat with yourself');
    if (await this.blocks.isBlocked(userId, other.id)) {
      throw new ForbiddenException('User is blocked');
    }

    const existing = await this.prisma.chat.findFirst({
      where: {
        type: 'direct',
        AND: [
          { members: { some: { userId } } },
          { members: { some: { userId: other.id } } },
        ],
      },
      include: { members: { include: { user: { select: { id: true, username: true, displayName: true, avatarKey: true, isOnline: true, lastSeenAt: true } } } } },
    });
    if (existing) return this.serializeChat(existing, userId);

    const chat = await this.prisma.chat.create({
      data: {
        type: 'direct',
        members: { create: [{ userId }, { userId: other.id }] },
      },
      include: { members: { include: { user: { select: { id: true, username: true, displayName: true, avatarKey: true, isOnline: true, lastSeenAt: true } } } } },
    });
    this.hub.sendToUsers([userId, other.id], { type: 'chat:updated', payload: { chatId: chat.id } });
    return this.serializeChat(chat, userId);
  }

  async getOrCreateSaved(userId: string) {
    const existing = await this.prisma.chat.findFirst({
      where: { type: 'saved', members: { some: { userId } } },
      include: { members: { include: { user: { select: { id: true, username: true, displayName: true, avatarKey: true, isOnline: true, lastSeenAt: true } } } } },
    });
    if (existing) return this.serializeChat(existing, userId);

    const chat = await this.prisma.chat.create({
      data: {
        type: 'saved',
        title: 'Избранное',
        members: { create: [{ userId, role: 'admin' }] },
      },
      include: { members: { include: { user: { select: { id: true, username: true, displayName: true, avatarKey: true, isOnline: true, lastSeenAt: true } } } } },
    });
    this.hub.sendToUser(userId, { type: 'chat:updated', payload: { chatId: chat.id } });
    return this.serializeChat(chat, userId);
  }

  async listForUser(userId: string) {
    const chats = await this.prisma.chat.findMany({
      where: { members: { some: { userId } } },
      include: {
        members: { include: { user: { select: { id: true, username: true, displayName: true, avatarKey: true, isOnline: true, lastSeenAt: true } } } },
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
          include: { user: { select: { id: true, username: true, displayName: true, avatarKey: true, isOnline: true, lastSeenAt: true } } },
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
        members: { include: { user: { select: { id: true, username: true, displayName: true, avatarKey: true, isOnline: true, lastSeenAt: true } } } },
      },
    });
    this.hub.sendToUsers([creatorId], { type: 'chat:updated', payload: { chatId: chat.id } });
    return this.serializeChat(chat, creatorId);
  }

  async joinChannel(userId: string, slug: string) {
    const chat = await this.prisma.chat.findUnique({
      where: { slug: slug.toLowerCase() },
      include: {
        members: { include: { user: { select: { id: true, username: true, displayName: true, avatarKey: true, isOnline: true, lastSeenAt: true } } } },
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
        members: { include: { user: { select: { id: true, username: true, displayName: true, avatarKey: true, isOnline: true, lastSeenAt: true } } } },
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
      include: { members: { include: { user: { select: { id: true, username: true, displayName: true, avatarKey: true, isOnline: true, lastSeenAt: true } } } } },
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
      where: {
        chatId,
        threadOfId: null,
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
      include: messageInclude,
    });
    return messages.reverse();
  }

  async listThreadMessages(chatId: string, userId: string, parentId: string, limit = 100) {
    await this.assertMember(chatId, userId);
    const parent = await this.prisma.message.findUnique({ where: { id: parentId } });
    if (!parent || parent.chatId !== chatId) throw new NotFoundException('Parent not found');
    const messages = await this.prisma.message.findMany({
      where: { chatId, threadOfId: parentId },
      orderBy: { createdAt: 'asc' },
      take: Math.min(limit, 200),
      include: messageInclude,
    });
    return messages;
  }

  async getThreadCount(chatId: string, parentId: string) {
    return this.prisma.message.count({ where: { chatId, threadOfId: parentId, deletedAt: null } });
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
      threadOfId?: string;
      pushPreview?: string;
      ttlSec?: number;
    },
  ) {
    const member = await this.assertMember(chatId, userId);
    const chatRow = await this.prisma.chat.findUnique({ where: { id: chatId }, select: { type: true } });

    // В канале только админы пишут в основную ленту. Комментарии под постом (threadOfId) — любой участник.
    if (chatRow?.type === 'channel' && member.role !== 'admin' && !payload.threadOfId) {
      throw new ForbiddenException('Only admins can post to channel');
    }

    // Для direct-чата проверяем блокировку
    if (chatRow?.type === 'direct') {
      const others = await this.prisma.chatMember.findMany({
        where: { chatId, userId: { not: userId } },
        select: { userId: true },
      });
      for (const o of others) {
        if (await this.blocks.isBlocked(userId, o.userId)) {
          throw new ForbiddenException('User is blocked');
        }
      }
    }

    // Проверка threadOf для комментариев
    if (payload.threadOfId) {
      const parent = await this.prisma.message.findUnique({ where: { id: payload.threadOfId } });
      if (!parent || parent.chatId !== chatId) {
        throw new NotFoundException('Parent message not found');
      }
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
      copiedMediaType = sticker.mediaType ?? 'image/png';
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

    const expiresAt = payload.ttlSec && payload.ttlSec > 0
      ? new Date(Date.now() + payload.ttlSec * 1000)
      : null;

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
        threadOfId: payload.threadOfId,
        expiresAt,
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
      const body = payload.pushPreview
        || (message.isSticker ? `${message.content} Стикер` : '')
        || message.content
        || (message.mediaType?.startsWith('image/') ? '📷 Фото' : message.mediaKey ? '📄 Файл' : '');
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

  /**
   * Удаляет (помечает deletedAt) сообщения с истёкшим expiresAt и
   * рассылает message:deleted всем участникам соответствующих чатов.
   * Вызывается из ChatsModule по таймеру.
   */
  async cleanupExpiredMessages() {
    const now = new Date();
    const expired = await this.prisma.message.findMany({
      where: {
        expiresAt: { lt: now },
        deletedAt: null,
      },
      select: { id: true, chatId: true },
      take: 200,
    });
    if (expired.length === 0) return 0;

    await this.prisma.message.updateMany({
      where: { id: { in: expired.map((m) => m.id) } },
      data: {
        content: '',
        mediaKey: null,
        mediaType: null,
        mediaName: null,
        mediaSize: null,
        deletedAt: now,
      },
    });

    // Сгруппировать по чату — чтобы один запрос на список участников
    const byChat = new Map<string, string[]>();
    for (const m of expired) {
      const arr = byChat.get(m.chatId) ?? [];
      arr.push(m.id);
      byChat.set(m.chatId, arr);
    }
    for (const [chatId, ids] of byChat) {
      const members = await this.prisma.chatMember.findMany({
        where: { chatId },
        select: { userId: true },
      });
      const userIds = members.map((mm) => mm.userId);
      for (const messageId of ids) {
        this.hub.sendToUsers(userIds, {
          type: 'message:deleted',
          payload: { chatId, messageId },
        });
      }
    }
    return expired.length;
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
      pinnedMessageId: (chat as { pinnedMessageId?: string | null }).pinnedMessageId ?? null,
      createdAt: chat.createdAt,
      viewerRole,
      viewerWallpaper: viewerMember?.wallpaper ?? null,
      memberCount: chat.members.length,
      members: visibleMembers,
    };
  }

  async searchMessages(chatId: string, userId: string, query: string, limit = 50) {
    await this.assertMember(chatId, userId);
    const q = query.trim();
    if (!q) return [];
    return this.prisma.message.findMany({
      where: {
        chatId,
        deletedAt: null,
        content: { contains: q, mode: 'insensitive' },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
      include: messageInclude,
    });
  }

  async pinMessage(chatId: string, userId: string, messageId: string) {
    const member = await this.assertMember(chatId, userId);
    const chat = await this.prisma.chat.findUnique({ where: { id: chatId }, select: { type: true } });
    if (!chat) throw new NotFoundException('Chat not found');
    // В group/channel пинить может только админ. В direct — оба участника.
    if (chat.type !== 'direct' && member.role !== 'admin') {
      throw new ForbiddenException('Admin only');
    }
    const msg = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!msg || msg.chatId !== chatId || msg.deletedAt) {
      throw new NotFoundException('Message not found');
    }
    await this.prisma.chat.update({ where: { id: chatId }, data: { pinnedMessageId: messageId } });
    const members = await this.prisma.chatMember.findMany({ where: { chatId }, select: { userId: true } });
    this.hub.sendToUsers(members.map((m) => m.userId), { type: 'chat:pinned', payload: { chatId, messageId } });
    return { ok: true };
  }

  async unpinMessage(chatId: string, userId: string) {
    const member = await this.assertMember(chatId, userId);
    const chat = await this.prisma.chat.findUnique({ where: { id: chatId }, select: { type: true } });
    if (!chat) throw new NotFoundException('Chat not found');
    if (chat.type !== 'direct' && member.role !== 'admin') {
      throw new ForbiddenException('Admin only');
    }
    await this.prisma.chat.update({ where: { id: chatId }, data: { pinnedMessageId: null } });
    const members = await this.prisma.chatMember.findMany({ where: { chatId }, select: { userId: true } });
    this.hub.sendToUsers(members.map((m) => m.userId), { type: 'chat:pinned', payload: { chatId, messageId: null } });
    return { ok: true };
  }

  async getPinnedMessage(chatId: string, userId: string) {
    await this.assertMember(chatId, userId);
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      select: { pinnedMessageId: true },
    });
    if (!chat?.pinnedMessageId) return null;
    return this.prisma.message.findUnique({
      where: { id: chat.pinnedMessageId },
      include: messageInclude,
    });
  }

  async toggleReaction(chatId: string, userId: string, messageId: string, emoji: string) {
    await this.assertMember(chatId, userId);
    const msg = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!msg || msg.chatId !== chatId) throw new NotFoundException('Message not found');

    const existing = await this.prisma.messageReaction.findUnique({
      where: { messageId_userId_emoji: { messageId, userId, emoji } },
    });

    if (existing) {
      await this.prisma.messageReaction.delete({ where: { id: existing.id } });
    } else {
      await this.prisma.messageReaction.create({ data: { messageId, userId, emoji } });
    }

    // Собираем актуальные реакции и рассылаем
    const reactions = await this.getReactions(messageId);
    const members = await this.prisma.chatMember.findMany({ where: { chatId }, select: { userId: true } });
    this.hub.sendToUsers(
      members.map((m) => m.userId),
      { type: 'message:reactions', payload: { chatId, messageId, reactions } },
    );
    return reactions;
  }

  async getReactions(messageId: string) {
    const rows = await this.prisma.messageReaction.findMany({
      where: { messageId },
      select: { emoji: true, userId: true },
    });
    // Группируем: { emoji, count, userIds, myReaction? }
    const map = new Map<string, string[]>();
    for (const r of rows) {
      const arr = map.get(r.emoji) || [];
      arr.push(r.userId);
      map.set(r.emoji, arr);
    }
    return Array.from(map.entries()).map(([emoji, userIds]) => ({
      emoji,
      count: userIds.length,
      userIds,
    }));
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
