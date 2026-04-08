import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChatsService } from './chats.service';
import { CreateDirectDto } from './dto/create-direct.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateChatDto } from './dto/update-chat.dto';
import { SendMessageDto } from './dto/send-message.dto';

@UseGuards(JwtAuthGuard)
@Controller('chats')
export class ChatsController {
  constructor(private readonly chats: ChatsService) {}

  @Post('direct')
  createDirect(@Req() req: { user: { userId: string } }, @Body() dto: CreateDirectDto) {
    return this.chats.createDirect(req.user.userId, dto.username);
  }

  @Post('group')
  createGroup(@Req() req: { user: { userId: string } }, @Body() dto: CreateGroupDto) {
    return this.chats.createGroup(req.user.userId, dto.title, dto.memberUsernames);
  }

  @Get()
  list(@Req() req: { user: { userId: string } }) {
    return this.chats.listForUser(req.user.userId);
  }

  @Get(':id')
  get(@Req() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.chats.getChat(id, req.user.userId);
  }

  @Patch(':id')
  update(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: UpdateChatDto,
  ) {
    return this.chats.updateChat(id, req.user.userId, dto.title);
  }

  @Post(':id/members')
  addMember(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.chats.addMember(id, req.user.userId, dto.username);
  }

  @Delete(':id/members/:userId')
  removeMember(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
  ) {
    return this.chats.removeMember(id, req.user.userId, targetUserId);
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
    return this.chats.sendMessage(id, req.user.userId, dto);
  }
}
