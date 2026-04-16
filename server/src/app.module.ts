import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { MailModule } from './mail/mail.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { WsModule } from './ws/ws.module';
import { ChatsModule } from './chats/chats.module';
import { MediaModule } from './media/media.module';
import { PushModule } from './push/push.module';
import { StickersModule } from './stickers/stickers.module';
import { PollsModule } from './polls/polls.module';
import { BlocksModule } from './blocks/blocks.module';
import { CallsModule } from './calls/calls.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    MailModule,
    AuthModule,
    UsersModule,
    WsModule,
    ChatsModule,
    MediaModule,
    PushModule,
    StickersModule,
    PollsModule,
    BlocksModule,
    CallsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
