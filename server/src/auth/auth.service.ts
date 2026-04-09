import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { RegisterDto } from './dto/register.dto';
import { VerifyDto } from './dto/verify.dto';
import { LoginDto } from './dto/login.dto';

const VERIFICATION_TTL_MIN = 15;
const REFRESH_TTL_DAYS = 30;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
    });
    if (existing) {
      throw new ConflictException('Email or username already taken');
    }

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        displayName: dto.displayName,
        passwordHash,
        isVerified: true,
      },
    });

    return this.issueTokens(user.id);
  }

  async verify(dto: VerifyDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new BadRequestException('Invalid email or code');

    const record = await this.prisma.emailVerification.findFirst({
      where: {
        userId: user.id,
        code: dto.code,
        consumed: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) throw new BadRequestException('Invalid email or code');

    await this.prisma.$transaction([
      this.prisma.emailVerification.update({
        where: { id: record.id },
        data: { consumed: true },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { isVerified: true },
      }),
    ]);

    return this.issueTokens(user.id);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const ok = await argon2.verify(user.passwordHash, dto.password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    if (!user.isVerified) {
      throw new UnauthorizedException('Email not verified');
    }

    return this.issueTokens(user.id);
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    const record = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!record || record.revoked || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // ротация: старый отзываем, выдаём новый
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revoked: true },
    });

    return this.issueTokens(record.userId);
  }

  private async issueVerificationCode(userId: string, email: string) {
    const code = ('' + Math.floor(100000 + Math.random() * 900000)).slice(0, 6);
    await this.prisma.emailVerification.create({
      data: {
        userId,
        code,
        expiresAt: new Date(Date.now() + VERIFICATION_TTL_MIN * 60 * 1000),
      },
    });
    await this.mail.sendVerificationCode(email, code);
  }

  private async issueTokens(userId: string) {
    const accessToken = await this.jwt.signAsync({ sub: userId });

    const refreshToken = crypto.randomBytes(48).toString('base64url');
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000),
      },
    });

    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
