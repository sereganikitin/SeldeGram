import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../prisma/prisma.service';

const MODEL = 'claude-haiku-4-5';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly client: Anthropic | null;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    const key = config.get<string>('ANTHROPIC_API_KEY');
    this.client = key ? new Anthropic({ apiKey: key }) : null;
    if (!this.client) {
      this.logger.warn('ANTHROPIC_API_KEY is not set — AI features disabled');
    }
  }

  private getClient(): Anthropic {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'AI временно недоступен (не настроен ANTHROPIC_API_KEY)',
      );
    }
    return this.client;
  }

  private async assertChatMember(userId: string, chatId: string) {
    const m = await this.prisma.chatMember.findFirst({
      where: { chatId, userId },
      select: { id: true },
    });
    if (!m) throw new ForbiddenException();
  }

  private extractText(resp: Anthropic.Messages.Message): string {
    for (const block of resp.content) {
      if (block.type === 'text') return block.text.trim();
    }
    return '';
  }

  async translate(userId: string, messageId: string, targetLang: string) {
    const client = this.getClient();
    const msg = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, chatId: true, content: true, deletedAt: true },
    });
    if (!msg || msg.deletedAt) throw new NotFoundException();
    if (!msg.content?.trim()) throw new BadRequestException('Сообщение без текста');
    await this.assertChatMember(userId, msg.chatId);

    const lang = (targetLang || 'русский').slice(0, 64);
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: [
        {
          type: 'text',
          text:
            'Ты переводчик в мессенджере. Переводи входящее сообщение на указанный язык точно, сохраняя интонацию и эмодзи. ' +
            'Отвечай ТОЛЬКО переводом без вступлений, кавычек или комментариев.',
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        { role: 'user', content: `Целевой язык: ${lang}\n\nТекст:\n${msg.content}` },
      ],
    });
    return { translated: this.extractText(resp), lang };
  }

  async summarize(userId: string, chatId: string) {
    const client = this.getClient();
    await this.assertChatMember(userId, chatId);

    const messages = await this.prisma.message.findMany({
      where: { chatId, deletedAt: null, content: { not: '' } },
      include: { sender: { select: { displayName: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    if (messages.length === 0) {
      return { summary: 'Сообщений пока нет.', usedMessages: 0 };
    }

    const transcript = messages
      .slice()
      .reverse()
      .map((m) => `${m.sender.displayName}: ${m.content}`)
      .join('\n');

    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text:
            'Ты делаешь краткое summary беседы в мессенджере. Отвечай на русском, маркированным списком из 3–6 пунктов: главные темы, решения, вопросы без ответа. ' +
            'Не приветствуй и не объясняй — сразу пунктами.',
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        { role: 'user', content: `Перепиши в виде summary этот разговор:\n\n${transcript}` },
      ],
    });
    return { summary: this.extractText(resp), usedMessages: messages.length };
  }
}
