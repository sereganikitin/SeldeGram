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
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CallsService } from './calls.service';
import { InitiateCallDto } from './dto/initiate-call.dto';

@UseGuards(JwtAuthGuard)
@Controller('calls')
export class CallsController {
  constructor(private readonly calls: CallsService) {}

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
