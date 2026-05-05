import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FoldersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const folders = await this.prisma.chatFolder.findMany({
      where: { userId },
      include: { entries: { select: { chatId: true } } },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });
    return folders.map((f) => ({
      id: f.id,
      name: f.name,
      emoji: f.emoji,
      order: f.order,
      chatIds: f.entries.map((e) => e.chatId),
    }));
  }

  async create(userId: string, name: string, emoji?: string) {
    if (!name?.trim()) throw new BadRequestException('Name is required');
    const last = await this.prisma.chatFolder.findFirst({
      where: { userId },
      orderBy: { order: 'desc' },
    });
    const folder = await this.prisma.chatFolder.create({
      data: {
        userId,
        name: name.trim().slice(0, 64),
        emoji: emoji?.slice(0, 8) ?? null,
        order: (last?.order ?? -1) + 1,
      },
    });
    return { id: folder.id, name: folder.name, emoji: folder.emoji, order: folder.order, chatIds: [] };
  }

  async rename(userId: string, folderId: string, name: string, emoji?: string) {
    const f = await this.prisma.chatFolder.findUnique({ where: { id: folderId } });
    if (!f || f.userId !== userId) throw new NotFoundException();
    const updated = await this.prisma.chatFolder.update({
      where: { id: folderId },
      data: {
        name: name.trim().slice(0, 64),
        emoji: emoji?.slice(0, 8) ?? null,
      },
    });
    return { id: updated.id, name: updated.name, emoji: updated.emoji, order: updated.order };
  }

  async remove(userId: string, folderId: string) {
    const f = await this.prisma.chatFolder.findUnique({ where: { id: folderId } });
    if (!f || f.userId !== userId) throw new NotFoundException();
    await this.prisma.chatFolder.delete({ where: { id: folderId } });
    return { ok: true };
  }

  async addChat(userId: string, folderId: string, chatId: string) {
    const f = await this.prisma.chatFolder.findUnique({ where: { id: folderId } });
    if (!f || f.userId !== userId) throw new NotFoundException();
    const member = await this.prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId } },
    });
    if (!member) throw new ForbiddenException();
    await this.prisma.chatFolderEntry.upsert({
      where: { folderId_chatId: { folderId, chatId } },
      create: { folderId, chatId },
      update: {},
    });
    return { ok: true };
  }

  async removeChat(userId: string, folderId: string, chatId: string) {
    const f = await this.prisma.chatFolder.findUnique({ where: { id: folderId } });
    if (!f || f.userId !== userId) throw new NotFoundException();
    await this.prisma.chatFolderEntry.deleteMany({ where: { folderId, chatId } });
    return { ok: true };
  }
}
