import { Body, Controller, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PollsService } from './polls.service';
import { CreatePollDto } from './dto/create-poll.dto';

@UseGuards(JwtAuthGuard)
@Controller()
export class PollsController {
  constructor(private readonly polls: PollsService) {}

  @Post('chats/:chatId/poll')
  create(
    @Req() req: { user: { userId: string } },
    @Param('chatId') chatId: string,
    @Body() dto: CreatePollDto,
  ) {
    return this.polls.create(chatId, req.user.userId, dto.question, dto.options);
  }

  @Post('polls/:id/vote')
  @HttpCode(200)
  vote(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: { optionIdx: number },
  ) {
    return this.polls.vote(id, req.user.userId, dto.optionIdx);
  }

  @Get('messages/:messageId/poll')
  getByMessage(@Param('messageId') messageId: string) {
    return this.polls.getByMessage(messageId);
  }
}
