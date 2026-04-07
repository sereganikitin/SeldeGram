import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChatsService } from './chats.service';
import { CreateDirectDto } from './dto/create-direct.dto';
import { SendMessageDto } from './dto/send-message.dto';

@UseGuards(JwtAuthGuard)
@Controller('chats')
export class ChatsController {
  constructor(private readonly chats: ChatsService) {}

  @Post('direct')
  createDirect(@Req() req: { user: { userId: string } }, @Body() dto: CreateDirectDto) {
    return this.chats.createDirect(req.user.userId, dto.username);
  }

  @Get()
  list(@Req() req: { user: { userId: string } }) {
    return this.chats.listForUser(req.user.userId);
  }

  @Get(':id/messages')
  messages(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Query('before') before?: string,
    @Query('limit') limit?: string,
  ) {
    return this.chats.listMessages(id, req.user.userId, before, limit ? parseInt(limit, 10) : 50);
  }

  @Post(':id/messages')
  send(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chats.sendMessage(id, req.user.userId, dto.content);
  }
}
