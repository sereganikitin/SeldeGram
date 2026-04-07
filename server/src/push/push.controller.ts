import { BadRequestException, Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PushService } from './push.service';
import { RegisterTokenDto } from './dto/register-token.dto';

@UseGuards(JwtAuthGuard)
@Controller('devices')
export class PushController {
  constructor(private readonly push: PushService) {}

  @Post('push-token')
  async register(@Req() req: { user: { userId: string } }, @Body() dto: RegisterTokenDto) {
    try {
      await this.push.registerToken(req.user.userId, dto.token, dto.deviceName ?? 'Unknown');
      return { ok: true };
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }
}
