import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WsGateway } from './ws.gateway';
import { WsHub } from './ws.hub';

@Global()
@Module({
  imports: [AuthModule],
  providers: [WsGateway, WsHub],
  exports: [WsHub],
})
export class WsModule {}
