import { Global, Module } from '@nestjs/common';
import { StickersService } from './stickers.service';
import { StickersController } from './stickers.controller';

@Global()
@Module({
  providers: [StickersService],
  controllers: [StickersController],
  exports: [StickersService],
})
export class StickersModule {}
