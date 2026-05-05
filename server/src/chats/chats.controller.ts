import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChatsService } from './chats.service';
import { CreateDirectDto } from './dto/create-direct.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { CreateChannelDto } from './dto/create-channel.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateChatDto } from './dto/update-chat.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { EditMessageDto } from './dto/edit-message.dto';
import { MarkReadDto } from './dto/mark-read.dto';

@UseGuards(JwtAuthGuard)
@Controller('chats')
export class ChatsController {
  constructor(private readonly chats: ChatsService) {}

  @Post('direct')
  createDirect(@Req() req: { user: { userId: string } }, @Body() dto: CreateDirectDto) {
    return this.chats.createDirect(req.user.userId, dto.username);
  }

  @Post('saved')
  getOrCreateSaved(@Req() req: { user: { userId: string } }) {
    return this.chats.getOrCreateSaved(req.user.userId);
  }

  @Post(':id/location')
  @HttpCode(200)
  shareLocation(
    @Req() req: { user: { userId: string } },
    @Param('id') chatId: string,
    @Body() body: { lat: number; lng: number; liveSec?: number },
  ) {
    return this.chats.shareLocation(chatId, req.user.userId, body.lat, body.lng, body.liveSec);
  }

  @Patch(':id/messages/:messageId/location')
  @HttpCode(200)
  updateLocation(
    @Req() req: { user: { userId: string } },
    @Param('id') chatId: string,
    @Param('messageId') messageId: string,
    @Body() body: { lat: number; lng: number },
  ) {
    return this.chats.updateLocation(chatId, messageId, req.user.userId, body.lat, body.lng);
  }

  @Patch(':id/membership')
  @HttpCode(200)
  updateMembership(
    @Req() req: { user: { userId: string } },
    @Param('id') chatId: string,
    @Body() body: { pinned?: boolean; muted?: boolean; archived?: boolean },
  ) {
    return this.chats.updateMembership(chatId, req.user.userId, body);
  }

  @Post('group')
  createGroup(@Req() req: { user: { userId: string } }, @Body() dto: CreateGroupDto) {
    return this.chats.createGroup(req.user.userId, dto.title, dto.memberUsernames);
  }

  @Post('channel')
  createChannel(@Req() req: { user: { userId: string } }, @Body() dto: CreateChannelDto) {
    return this.chats.createChannel(req.user.userId, dto.title, dto.slug);
  }

  @Post('channel/:slug/join')
  @HttpCode(200)
  joinChannel(@Req() req: { user: { userId: string } }, @Param('slug') slug: string) {
    return this.chats.joinChannel(req.user.userId, slug);
  }

  @Get('channels/search')
  searchChannels(@Query('q') q: string) {
    return this.chats.searchChannels(q ?? '');
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
  update(@Req() req: { user: { userId: string } }, @Param('id') id: string, @Body() dto: UpdateChatDto) {
    return this.chats.updateChat(id, req.user.userId, dto.title);
  }

  @Patch(':id/wallpaper')
  setWallpaper(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: { wallpaper: string | null },
  ) {
    return this.chats.setWallpaper(id, req.user.userId, dto.wallpaper);
  }

  @Delete(':id')
  remove(@Req() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.chats.deleteChat(id, req.user.userId);
  }

  @Post(':id/members')
  addMember(@Req() req: { user: { userId: string } }, @Param('id') id: string, @Body() dto: AddMemberDto) {
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

  @Get(':id/search')
  search(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Query('q') q: string,
    @Query('limit') limit?: string,
  ) {
    return this.chats.searchMessages(id, req.user.userId, q ?? '', limit ? parseInt(limit, 10) : 50);
  }

  @Get(':id/pinned')
  getPinned(@Req() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.chats.getPinnedMessage(id, req.user.userId);
  }

  @Post(':id/pin/:msgId')
  @HttpCode(200)
  pin(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Param('msgId') msgId: string,
  ) {
    return this.chats.pinMessage(id, req.user.userId, msgId);
  }

  @Delete(':id/pin')
  unpin(@Req() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.chats.unpinMessage(id, req.user.userId);
  }

  @Get(':id/thread/:msgId')
  thread(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Param('msgId') msgId: string,
  ) {
    return this.chats.listThreadMessages(id, req.user.userId, msgId);
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
  send(@Req() req: { user: { userId: string } }, @Param('id') id: string, @Body() dto: SendMessageDto) {
    return this.chats.sendMessage(id, req.user.userId, dto);
  }

  @Patch(':id/messages/:msgId')
  edit(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Param('msgId') msgId: string,
    @Body() dto: EditMessageDto,
  ) {
    return this.chats.editMessage(id, req.user.userId, msgId, dto.content);
  }

  @Delete(':id/messages/:msgId')
  removeMessage(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Param('msgId') msgId: string,
  ) {
    return this.chats.deleteMessage(id, req.user.userId, msgId);
  }

  @Post(':id/read')
  @HttpCode(200)
  markRead(@Req() req: { user: { userId: string } }, @Param('id') id: string, @Body() dto: MarkReadDto) {
    return this.chats.markRead(id, req.user.userId, dto.messageId);
  }

  @Get(':id/reads')
  reads(@Req() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.chats.getChatReads(id, req.user.userId);
  }

  @Post(':id/typing')
  @HttpCode(200)
  typing(@Req() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.chats.typing(id, req.user.userId);
  }

  @Post(':id/messages/:msgId/react')
  @HttpCode(200)
  react(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Param('msgId') msgId: string,
    @Body() dto: { emoji: string },
  ) {
    return this.chats.toggleReaction(id, req.user.userId, msgId, dto.emoji);
  }
}
