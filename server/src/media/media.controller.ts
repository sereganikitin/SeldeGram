import { BadRequestException, Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MediaService } from './media.service';
import { PresignDto } from './dto/presign.dto';

@UseGuards(JwtAuthGuard)
@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Post('presign')
  async presign(@Req() req: { user: { userId: string } }, @Body() dto: PresignDto) {
    try {
      return await this.media.createUploadUrl(req.user.userId, dto.contentType, dto.size);
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
  }

  @Get(':key(*)')
  async download(@Param('key') key: string) {
    const url = await this.media.createDownloadUrl(key);
    return { url };
  }
}
