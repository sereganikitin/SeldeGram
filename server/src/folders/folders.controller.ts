import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FoldersService } from './folders.service';

@UseGuards(JwtAuthGuard)
@Controller('folders')
export class FoldersController {
  constructor(private readonly folders: FoldersService) {}

  @Get()
  list(@Req() req: { user: { userId: string } }) {
    return this.folders.list(req.user.userId);
  }

  @Post()
  create(
    @Req() req: { user: { userId: string } },
    @Body() body: { name: string; emoji?: string },
  ) {
    return this.folders.create(req.user.userId, body.name, body.emoji);
  }

  @Patch(':id')
  @HttpCode(200)
  rename(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() body: { name: string; emoji?: string },
  ) {
    return this.folders.rename(req.user.userId, id, body.name, body.emoji);
  }

  @Delete(':id')
  @HttpCode(200)
  remove(@Req() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.folders.remove(req.user.userId, id);
  }

  @Post(':id/chats/:chatId')
  @HttpCode(200)
  addChat(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Param('chatId') chatId: string,
  ) {
    return this.folders.addChat(req.user.userId, id, chatId);
  }

  @Delete(':id/chats/:chatId')
  @HttpCode(200)
  removeChat(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Param('chatId') chatId: string,
  ) {
    return this.folders.removeChat(req.user.userId, id, chatId);
  }
}
