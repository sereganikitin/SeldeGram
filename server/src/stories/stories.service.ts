import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStoryDto } from './dto/create-story.dto';

const STORY_TTL_HOURS = 24;

const AUTHOR_SELECT = {
  id: true,
  username: true,
  displayName: true,
  avatarKey: true,
} as const;

@Injectable()
export class StoriesService {
  private readonly logger = new Logger(StoriesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(authorId: string, dto: CreateStoryDto) {
    const expiresAt = new Date(Date.now() + STORY_TTL_HOURS * 60 * 60 * 1000);
    const story = await this.prisma.story.create({
      data: {
        authorId,
        mediaKey: dto.mediaKey,
        mediaType: dto.mediaType,
        expiresAt,
      },
    });
    return story;
  }

  /**
   * Лента — активные истории всех пользователей, сгруппированные по автору.
   * Свой собственный автор идёт первым (если у него есть истории).
   */
  async feed(viewerId: string) {
    const now = new Date();
    const stories = await this.prisma.story.findMany({
      where: { expiresAt: { gt: now } },
      include: {
        author: { select: AUTHOR_SELECT },
        views: { where: { userId: viewerId }, select: { id: true } },
        _count: { select: { views: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    type StoryRow = typeof stories[number];
    const groups = new Map<
      string,
      { author: StoryRow['author']; stories: Array<StoryRow & { viewedByMe: boolean; viewsCount: number }> }
    >();
    for (const s of stories) {
      const enriched = {
        ...s,
        viewedByMe: s.views.length > 0,
        viewsCount: s._count.views,
      };
      const g = groups.get(s.authorId);
      if (g) g.stories.push(enriched);
      else groups.set(s.authorId, { author: s.author, stories: [enriched] });
    }

    const arr = Array.from(groups.values()).map((g) => ({
      author: g.author,
      stories: g.stories,
      hasUnseen: g.stories.some((s) => !s.viewedByMe),
    }));
    arr.sort((a, b) => {
      if (a.author.id === viewerId) return -1;
      if (b.author.id === viewerId) return 1;
      // непросмотренные сверху
      if (a.hasUnseen !== b.hasUnseen) return a.hasUnseen ? -1 : 1;
      const al = a.stories[a.stories.length - 1].createdAt.getTime();
      const bl = b.stories[b.stories.length - 1].createdAt.getTime();
      return bl - al;
    });
    return arr;
  }

  async markViewed(viewerId: string, storyId: string) {
    const story = await this.prisma.story.findUnique({ where: { id: storyId } });
    if (!story) throw new NotFoundException('Story not found');
    if (story.authorId === viewerId) return { ok: true }; // автор не считается просмотром
    await this.prisma.storyView.upsert({
      where: { storyId_userId: { storyId, userId: viewerId } },
      update: {},
      create: { storyId, userId: viewerId },
    });
    return { ok: true };
  }

  async listViewers(authorId: string, storyId: string) {
    const story = await this.prisma.story.findUnique({ where: { id: storyId } });
    if (!story) throw new NotFoundException('Story not found');
    if (story.authorId !== authorId) throw new ForbiddenException();
    const views = await this.prisma.storyView.findMany({
      where: { storyId },
      include: { user: { select: AUTHOR_SELECT } },
      orderBy: { viewedAt: 'desc' },
    });
    return views.map((v) => ({ user: v.user, viewedAt: v.viewedAt }));
  }

  async my(userId: string) {
    const now = new Date();
    return this.prisma.story.findMany({
      where: { authorId: userId, expiresAt: { gt: now } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async remove(userId: string, id: string) {
    const story = await this.prisma.story.findUnique({ where: { id } });
    if (!story) throw new NotFoundException('Story not found');
    if (story.authorId !== userId) throw new ForbiddenException();
    await this.prisma.story.delete({ where: { id } });
    return { ok: true };
  }

  /** Удаляет все истории с expiresAt в прошлом. Вызывается cron-ом. */
  async cleanupExpired() {
    const now = new Date();
    const res = await this.prisma.story.deleteMany({
      where: { expiresAt: { lt: now } },
    });
    if (res.count > 0) this.logger.log(`Cleaned up ${res.count} expired stories`);
    return res.count;
  }
}
