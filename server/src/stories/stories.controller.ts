import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StoriesService } from './stories.service';
import { CreateStoryDto } from './dto/create-story.dto';

@UseGuards(JwtAuthGuard)
@Controller('stories')
export class StoriesController {
  constructor(private readonly stories: StoriesService) {}

  @Post()
  create(@Req() req: { user: { userId: string } }, @Body() dto: CreateStoryDto) {
    return this.stories.create(req.user.userId, dto);
  }

  @Get()
  feed(@Req() req: { user: { userId: string } }) {
    return this.stories.feed(req.user.userId);
  }

  @Get('my')
  my(@Req() req: { user: { userId: string } }) {
    return this.stories.my(req.user.userId);
  }

  @Delete(':id')
  @HttpCode(200)
  remove(@Req() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.stories.remove(req.user.userId, id);
  }

  @Post(':id/view')
  @HttpCode(200)
  markViewed(@Req() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.stories.markViewed(req.user.userId, id);
  }

  @Get(':id/viewers')
  listViewers(@Req() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.stories.listViewers(req.user.userId, id);
  }
}
