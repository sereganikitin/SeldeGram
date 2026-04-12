import { Body, Controller, Get, NotFoundException, Param, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';
import { UpdateMeDto } from './dto/update-me.dto';

const ME_SELECT = {
  id: true,
  email: true,
  username: true,
  displayName: true,
  isVerified: true,
  avatarKey: true,
  defaultWallpaper: true,
  publicKey: true,
  createdAt: true,
} as const;

@Controller()
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: { user: { userId: string } }) {
    const user = await this.prisma.user.findUnique({
      where: { id: req.user.userId },
      select: ME_SELECT,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateMe(@Req() req: { user: { userId: string } }, @Body() dto: UpdateMeDto) {
    const user = await this.prisma.user.update({
      where: { id: req.user.userId },
      data: {
        ...(dto.displayName !== undefined && { displayName: dto.displayName }),
        ...(dto.avatarKey !== undefined && { avatarKey: dto.avatarKey }),
        ...(dto.defaultWallpaper !== undefined && { defaultWallpaper: dto.defaultWallpaper }),
        ...(dto.publicKey !== undefined && { publicKey: dto.publicKey }),
      },
      select: ME_SELECT,
    });
    return user;
  }

  @UseGuards(JwtAuthGuard)
  @Get('users/search')
  search(@Req() req: { user: { userId: string } }, @Query('q') q: string) {
    return this.users.search(q ?? '', req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('users/:id/keys')
  async getKeys(@Param('id') id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, publicKey: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
