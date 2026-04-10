import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WsHub } from '../ws/ws.hub';

// votes JSON structure: { [userId: string]: number } — index of chosen option

@Injectable()
export class PollsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hub: WsHub,
  ) {}

  async create(chatId: string, userId: string, question: string, options: string[]) {
    // Проверяем что пользователь — участник чата
    const member = await this.prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId, userId } },
    });
    if (!member) throw new ForbiddenException('Not a member');

    // Создаём сообщение-контейнер для опроса
    const message = await this.prisma.message.create({
      data: {
        chatId,
        senderId: userId,
        content: `📊 ${question}`,
      },
    });

    const poll = await this.prisma.poll.create({
      data: {
        chatId,
        senderId: userId,
        messageId: message.id,
        question,
        options: JSON.stringify(options),
        votes: JSON.stringify({}),
      },
    });

    // Рассылаем WS
    const members = await this.prisma.chatMember.findMany({ where: { chatId }, select: { userId: true } });
    this.hub.sendToUsers(
      members.map((m) => m.userId),
      { type: 'message:new', payload: { ...message, poll: this.serialize(poll) } },
    );

    return { message, poll: this.serialize(poll) };
  }

  async vote(pollId: string, userId: string, optionIdx: number) {
    const poll = await this.prisma.poll.findUnique({ where: { id: pollId } });
    if (!poll) throw new NotFoundException('Poll not found');

    const member = await this.prisma.chatMember.findUnique({
      where: { chatId_userId: { chatId: poll.chatId, userId } },
    });
    if (!member) throw new ForbiddenException('Not a member');

    const options = JSON.parse(poll.options as string) as string[];
    if (optionIdx < 0 || optionIdx >= options.length) throw new ForbiddenException('Invalid option');

    const votes = JSON.parse(poll.votes as string) as Record<string, number>;
    votes[userId] = optionIdx;

    const updated = await this.prisma.poll.update({
      where: { id: pollId },
      data: { votes: JSON.stringify(votes) },
    });

    const members = await this.prisma.chatMember.findMany({
      where: { chatId: poll.chatId },
      select: { userId: true },
    });
    this.hub.sendToUsers(
      members.map((m) => m.userId),
      { type: 'poll:updated', payload: this.serialize(updated) },
    );

    return this.serialize(updated);
  }

  async getByMessage(messageId: string) {
    const poll = await this.prisma.poll.findUnique({ where: { messageId } });
    if (!poll) return null;
    return this.serialize(poll);
  }

  private serialize(poll: { id: string; chatId: string; senderId: string; messageId: string; question: string; options: unknown; votes: unknown }) {
    const options = typeof poll.options === 'string' ? JSON.parse(poll.options) : poll.options;
    const votes = typeof poll.votes === 'string' ? JSON.parse(poll.votes) : poll.votes;
    const totalVotes = Object.keys(votes).length;
    const counts: number[] = (options as string[]).map((_: string, i: number) =>
      Object.values(votes as Record<string, number>).filter((v) => v === i).length,
    );
    return {
      id: poll.id,
      chatId: poll.chatId,
      senderId: poll.senderId,
      messageId: poll.messageId,
      question: poll.question,
      options,
      votes,
      totalVotes,
      counts,
    };
  }
}
