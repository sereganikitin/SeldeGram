import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CallsService } from './calls.service';
import { InitiateCallDto } from './dto/initiate-call.dto';

@UseGuards(JwtAuthGuard)
@Controller('calls')
export class CallsController {
  constructor(
    private readonly calls: CallsService,
    private readonly config: ConfigService,
  ) {}

  @Get('ice-config')
  iceConfig() {
    const stunUrl = this.config.get<string>('STUN_URL') || 'stun:stun.l.google.com:19302';
    const stun2Url = 'stun:stun1.l.google.com:19302';
    const turnUrl = this.config.get<string>('TURN_URL');
    const turnUsername = this.config.get<string>('TURN_USERNAME');
    const turnCredential = this.config.get<string>('TURN_PASSWORD');

    const servers: Array<{ urls: string | string[]; username?: string; credential?: string }> = [
      { urls: stunUrl },
      { urls: stun2Url },
    ];
    if (turnUrl && turnUsername && turnCredential) {
      // turn:host:port?transport=udp / turn:host:port?transport=tcp / turns:host:port
      servers.push({ urls: turnUrl, username: turnUsername, credential: turnCredential });
    }
    return { iceServers: servers };
  }

  @Post()
  initiate(@Req() req: { user: { userId: string } }, @Body() dto: InitiateCallDto) {
    return this.calls.initiate(req.user.userId, dto.calleeId, dto.kind ?? 'audio');
  }

  @Post(':id/accept')
  @HttpCode(200)
  accept(@Req() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.calls.accept(req.user.userId, id);
  }

  @Post(':id/reject')
  @HttpCode(200)
  reject(@Req() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.calls.reject(req.user.userId, id);
  }

  @Post(':id/end')
  @HttpCode(200)
  end(@Req() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.calls.end(req.user.userId, id);
  }

  @Get()
  history(
    @Req() req: { user: { userId: string } },
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    const n = limit ? parseInt(limit, 10) : 50;
    return this.calls.history(req.user.userId, Number.isFinite(n) ? n : 50, before);
  }
}
