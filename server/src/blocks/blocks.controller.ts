import { Controller, Delete, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BlocksService } from './blocks.service';

@UseGuards(JwtAuthGuard)
@Controller('me/blocks')
export class BlocksController {
  constructor(private readonly blocks: BlocksService) {}

  @Get()
  list(@Req() req: { user: { userId: string } }) {
    return this.blocks.list(req.user.userId);
  }

  @Post(':userId')
  @HttpCode(200)
  block(@Req() req: { user: { userId: string } }, @Param('userId') userId: string) {
    return this.blocks.block(req.user.userId, userId);
  }

  @Delete(':userId')
  unblock(@Req() req: { user: { userId: string } }, @Param('userId') userId: string) {
    return this.blocks.unblock(req.user.userId, userId);
  }
}
