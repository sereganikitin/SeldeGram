import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AiService } from './ai.service';
import { TranslateDto } from './dto/translate.dto';
import { SummarizeDto } from './dto/summarize.dto';

@UseGuards(JwtAuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Post('translate')
  @HttpCode(200)
  translate(@Req() req: { user: { userId: string } }, @Body() dto: TranslateDto) {
    return this.ai.translate(req.user.userId, dto.messageId, dto.lang ?? 'русский');
  }

  @Post('summarize')
  @HttpCode(200)
  summarize(@Req() req: { user: { userId: string } }, @Body() dto: SummarizeDto) {
    return this.ai.summarize(req.user.userId, dto.chatId);
  }
}
