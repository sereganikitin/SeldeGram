import { Module, OnModuleInit } from '@nestjs/common';
import { StoriesController } from './stories.controller';
import { StoriesService } from './stories.service';

@Module({
  controllers: [StoriesController],
  providers: [StoriesService],
})
export class StoriesModule implements OnModuleInit {
  constructor(private readonly stories: StoriesService) {}

  onModuleInit() {
    // Чистка просроченных историй каждый час
    setInterval(() => {
      this.stories.cleanupExpired().catch(() => undefined);
    }, 60 * 60 * 1000);
    // И один раз при старте
    this.stories.cleanupExpired().catch(() => undefined);
  }
}
