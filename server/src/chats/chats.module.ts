import { Module, OnModuleInit } from '@nestjs/common';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';

@Module({
  controllers: [ChatsController],
  providers: [ChatsService],
})
export class ChatsModule implements OnModuleInit {
  constructor(private readonly chats: ChatsService) {}

  onModuleInit() {
    // Раз в 30 секунд удаляем сообщения у которых истёк expiresAt.
    // Минимум TTL — 5 секунд (валидируется в DTO), так что задержка
    // удаления до 30s после expiresAt приемлема.
    setInterval(() => {
      this.chats.cleanupExpiredMessages().catch(() => undefined);
    }, 30_000);
    this.chats.cleanupExpiredMessages().catch(() => undefined);
  }
}
