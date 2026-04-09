import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StickersService } from './stickers.service';
import { CreatePackDto } from './dto/create-pack.dto';
import { AddStickerDto } from './dto/add-sticker.dto';

@UseGuards(JwtAuthGuard)
@Controller('stickers')
export class StickersController {
  constructor(private readonly stickers: StickersService) {}

  @Post('packs')
  createPack(@Req() req: { user: { userId: string } }, @Body() dto: CreatePackDto) {
    return this.stickers.createPack(req.user.userId, dto.name, dto.slug, dto.coverKey);
  }

  @Delete('packs/:id')
  deletePack(@Req() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.stickers.deletePack(req.user.userId, id);
  }

  @Post('packs/:id/stickers')
  addSticker(
    @Req() req: { user: { userId: string } },
    @Param('id') packId: string,
    @Body() dto: AddStickerDto,
  ) {
    return this.stickers.addSticker(req.user.userId, packId, dto.mediaKey, dto.emoji, dto.mediaType);
  }

  @Delete('packs/:id/stickers/:stickerId')
  removeSticker(
    @Req() req: { user: { userId: string } },
    @Param('id') packId: string,
    @Param('stickerId') stickerId: string,
  ) {
    return this.stickers.removeSticker(req.user.userId, packId, stickerId);
  }

  @Get('packs/search')
  search(@Query('q') q: string) {
    return this.stickers.searchPacks(q ?? '');
  }

  @Get('packs/by-slug/:slug')
  getBySlug(@Param('slug') slug: string) {
    return this.stickers.getPackBySlug(slug);
  }

  @Get('packs/:id')
  getPack(@Param('id') id: string) {
    return this.stickers.getPack(id);
  }

  @Post('packs/:id/install')
  install(@Req() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.stickers.install(req.user.userId, id);
  }

  @Delete('packs/:id/install')
  uninstall(@Req() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.stickers.uninstall(req.user.userId, id);
  }

  @Get('my')
  myPacks(@Req() req: { user: { userId: string } }) {
    return this.stickers.myPacks(req.user.userId);
  }

  @Get('recent')
  recent(@Req() req: { user: { userId: string } }) {
    return this.stickers.recentStickers(req.user.userId);
  }
}
