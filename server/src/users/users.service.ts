import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  search(query: string, excludeUserId: string, limit = 20) {
    const q = query.trim();
    if (!q) return Promise.resolve([]);
    return this.prisma.user.findMany({
      where: {
        id: { not: excludeUserId },
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
