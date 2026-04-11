import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BlocksService } from '../blocks/blocks.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blocks: BlocksService,
  ) {}

  async search(query: string, excludeUserId: string, limit = 20) {
    const q = query.trim();
    if (!q) return [];
    const blockedIds = await this.blocks.blockedWith(excludeUserId);
    return this.prisma.user.findMany({
      where: {
        id: { not: excludeUserId, notIn: blockedIds },
        isVerified: true,
        OR: [
          { username: { contains: q, mode: 'insensitive' } },
          { displayName: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, username: true, displayName: true, avatarKey: true },
      take: limit,
    });
  }
}
