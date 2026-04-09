import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StickersService {
  constructor(private readonly prisma: PrismaService) {}

  async createPack(authorId: string, name: string, slug: string, coverKey?: string) {
    const slugLower = slug.toLowerCase();
    const existing = await this.prisma.stickerPack.findUnique({ where: { slug: slugLower } });
    if (existing) throw new ForbiddenException('Slug already taken');
    const pack = await this.prisma.stickerPack.create({
      data: { authorId, name, slug: slugLower, coverKey },
      include: { stickers: true },
    });
    // создатель сразу подписан на свой пак
    await this.prisma.userStickerPack.create({ data: { userId: authorId, packId: pack.id } });
    return pack;
  }

  async deletePack(authorId: string, packId: string) {
    const pack = await this.prisma.stickerPack.findUnique({ where: { id: packId } });
    if (!pack) throw new NotFoundException('Pack not found');
    if (pack.authorId !== authorId) throw new ForbiddenException('Not your pack');
    await this.prisma.stickerPack.delete({ where: { id: packId } });
    return { ok: true };
  }

  async addSticker(authorId: string, packId: string, mediaKey: string, emoji: string, mediaType?: string) {
    const pack = await this.prisma.stickerPack.findUnique({ where: { id: packId } });
    if (!pack) throw new NotFoundException('Pack not found');
    if (pack.authorId !== authorId) throw new ForbiddenException('Not your pack');

    const last = await this.prisma.sticker.findFirst({
      where: { packId },
      orderBy: { order: 'desc' },
    });
    const order = (last?.order ?? -1) + 1;

    const sticker = await this.prisma.sticker.create({
      data: { packId, mediaKey, mediaType: mediaType ?? 'image/png', emoji, order },
    });

    // Если у пака ещё нет обложки — ставим первый стикер
    if (!pack.coverKey) {
      await this.prisma.stickerPack.update({
        where: { id: packId },
        data: { coverKey: mediaKey },
      });
    }

    return sticker;
  }

  async removeSticker(authorId: string, packId: string, stickerId: string) {
    const pack = await this.prisma.stickerPack.findUnique({ where: { id: packId } });
    if (!pack) throw new NotFoundException('Pack not found');
    if (pack.authorId !== authorId) throw new ForbiddenException('Not your pack');
    await this.prisma.sticker.delete({ where: { id: stickerId } });
    return { ok: true };
  }

  async getPack(packId: string) {
    const pack = await this.prisma.stickerPack.findUnique({
      where: { id: packId },
      include: { stickers: { orderBy: { order: 'asc' } } },
    });
    if (!pack) throw new NotFoundException('Pack not found');
    return pack;
  }

  async getPackBySlug(slug: string) {
    const pack = await this.prisma.stickerPack.findUnique({
      where: { slug: slug.toLowerCase() },
      include: { stickers: { orderBy: { order: 'asc' } } },
    });
    if (!pack) throw new NotFoundException('Pack not found');
    return pack;
  }

  async searchPacks(query: string) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return this.prisma.stickerPack.findMany({
      where: {
        OR: [
          { slug: { contains: q } },
          { name: { contains: q, mode: 'insensitive' } },
        ],
      },
      include: { _count: { select: { stickers: true } } },
      take: 30,
    });
  }

  async install(userId: string, packId: string) {
    const pack = await this.prisma.stickerPack.findUnique({ where: { id: packId } });
    if (!pack) throw new NotFoundException('Pack not found');
    await this.prisma.userStickerPack.upsert({
      where: { userId_packId: { userId, packId } },
      create: { userId, packId },
      update: {},
    });
    return { ok: true };
  }

  async uninstall(userId: string, packId: string) {
    await this.prisma.userStickerPack.deleteMany({ where: { userId, packId } });
    return { ok: true };
  }

  async myPacks(userId: string) {
    const installs = await this.prisma.userStickerPack.findMany({
      where: { userId },
      include: {
        pack: { include: { stickers: { orderBy: { order: 'asc' } } } },
      },
      orderBy: { installedAt: 'asc' },
    });
    return installs.map((i) => i.pack);
  }

  async recentStickers(userId: string, limit = 30) {
    const items = await this.prisma.recentSticker.findMany({
      where: { userId },
      orderBy: { lastUsedAt: 'desc' },
      take: limit,
      include: { sticker: true },
    });
    return items.map((i) => i.sticker);
  }

  async markUsed(userId: string, stickerId: string) {
    await this.prisma.recentSticker.upsert({
      where: { userId_stickerId: { userId, stickerId } },
      create: { userId, stickerId },
      update: { lastUsedAt: new Date() },
    });
  }
}
