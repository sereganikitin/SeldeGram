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
import { SmsService } from '../sms/sms.service';
import * as speakeasy from 'speakeasy';
import { RegisterDto } from './dto/register.dto';
import { VerifyDto } from './dto/verify.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { PhoneRequestDto } from './dto/phone-request.dto';
import { PhoneVerifyDto } from './dto/phone-verify.dto';

const VERIFICATION_TTL_MIN = 15;
const PASSWORD_RESET_TTL_MIN = 15;
const PHONE_OTP_TTL_MIN = 10;
const PHONE_OTP_RESEND_SEC = 60;
const PHONE_OTP_DAILY_LIMIT = 5;
const REFRESH_TTL_DAYS = 30;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly sms: SmsService,
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

    if (user.totpEnabled) {
      if (!dto.totpCode) {
        return { requires2fa: true } as { requires2fa: true };
      }
      const ok2 = await this.verifyTotpCode(user.totpSecret ?? '', dto.totpCode);
      if (!ok2) throw new UnauthorizedException('Invalid 2FA code');
    }

    return this.issueTokens(user.id);
  }

  async verifyTotpCode(secret: string, code: string): Promise<boolean> {
    if (!secret || !code) return false;
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: code.replace(/\s+/g, ''),
      window: 1,
    });
  }

  async startTotp(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    const gen = speakeasy.generateSecret({
      name: `CraboGram (${user.email})`,
      issuer: 'CraboGram',
    });
    const secret = gen.base32;
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecret: secret, totpEnabled: false },
    });
    const otpauth = gen.otpauth_url ?? `otpauth://totp/CraboGram:${encodeURIComponent(user.email)}?secret=${secret}&issuer=CraboGram`;
    return { secret, otpauth };
  }

  async confirmTotp(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.totpSecret) throw new UnauthorizedException('No pending 2FA setup');
    const ok = await this.verifyTotpCode(user.totpSecret, code);
    if (!ok) throw new UnauthorizedException('Invalid code');
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: true },
    });
    return { ok: true };
  }

  async disableTotp(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.totpEnabled) return { ok: true };
    const ok = await this.verifyTotpCode(user.totpSecret ?? '', code);
    if (!ok) throw new UnauthorizedException('Invalid code');
    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecret: null, totpEnabled: false },
    });
    return { ok: true };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    // Всегда отвечаем одинаково, чтобы не раскрывать существование email
    if (user) {
      const code = ('' + Math.floor(100000 + Math.random() * 900000)).slice(0, 6);
      await this.prisma.passwordReset.create({
        data: {
          userId: user.id,
          code,
          expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MIN * 60 * 1000),
        },
      });
      await this.mail.sendPasswordResetCode(user.email, code);
    }
    return { ok: true };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new BadRequestException('Invalid email or code');

    const record = await this.prisma.passwordReset.findFirst({
      where: {
        userId: user.id,
        code: dto.code,
        consumed: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) throw new BadRequestException('Invalid email or code');

    const passwordHash = await argon2.hash(dto.newPassword);

    await this.prisma.$transaction([
      this.prisma.passwordReset.update({
        where: { id: record.id },
        data: { consumed: true },
      }),
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      // отзываем все активные refresh-токены — пользователь должен войти заново
      this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revoked: false },
        data: { revoked: true },
      }),
    ]);

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

  async requestPhoneCode(dto: PhoneRequestDto) {
    const phone = dto.phone;

    // anti-spam: не чаще раза в минуту, ≤5 в сутки
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await this.prisma.phoneVerification.findMany({
      where: { phone, createdAt: { gt: dayAgo } },
      orderBy: { createdAt: 'desc' },
      take: PHONE_OTP_DAILY_LIMIT,
    });
    if (recent[0]) {
      const sinceLast = (Date.now() - recent[0].createdAt.getTime()) / 1000;
      if (sinceLast < PHONE_OTP_RESEND_SEC) {
        throw new BadRequestException(
          `Подождите ${Math.ceil(PHONE_OTP_RESEND_SEC - sinceLast)} сек перед повторной отправкой`,
        );
      }
    }
    if (recent.length >= PHONE_OTP_DAILY_LIMIT) {
      throw new BadRequestException('Слишком много попыток за сутки. Попробуйте завтра.');
    }

    const code = ('' + Math.floor(100000 + Math.random() * 900000)).slice(0, 6);
    const existing = await this.prisma.user.findUnique({ where: { phone } });

    await this.prisma.phoneVerification.create({
      data: {
        userId: existing?.id ?? null,
        phone,
        code,
        expiresAt: new Date(Date.now() + PHONE_OTP_TTL_MIN * 60 * 1000),
      },
    });

    const sent = await this.sms.sendOtp(phone, code);
    if (!sent) throw new BadRequestException('Не удалось отправить SMS');

    return {
      ok: true,
      needsRegistration: !existing,
      resendAfterSec: PHONE_OTP_RESEND_SEC,
    };
  }

  async verifyPhoneCode(dto: PhoneVerifyDto) {
    const record = await this.prisma.phoneVerification.findFirst({
      where: {
        phone: dto.phone,
        consumed: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!record) throw new BadRequestException('Код не найден или истёк');

    if (record.code !== dto.code) {
      if (record.attemptsLeft <= 1) {
        await this.prisma.phoneVerification.update({
          where: { id: record.id },
          data: { consumed: true, attemptsLeft: 0 },
        });
        throw new BadRequestException('Превышено число попыток');
      }
      await this.prisma.phoneVerification.update({
        where: { id: record.id },
        data: { attemptsLeft: { decrement: 1 } },
      });
      throw new BadRequestException('Неверный код');
    }

    await this.prisma.phoneVerification.update({
      where: { id: record.id },
      data: { consumed: true },
    });

    let user = await this.prisma.user.findUnique({ where: { phone: dto.phone } });

    if (!user) {
      // регистрация — username и displayName обязательны
      if (!dto.username || !dto.displayName) {
        throw new BadRequestException('Username and displayName required for new account');
      }
      const conflict = await this.prisma.user.findFirst({
        where: { OR: [{ username: dto.username }, { email: this.phoneToPseudoEmail(dto.phone) }] },
      });
      if (conflict) {
        throw new ConflictException('Username already taken');
      }
      // Email обязателен в схеме — используем псевдо-email для phone-only юзеров.
      // Юзер сможет привязать настоящий email позже из настроек.
      user = await this.prisma.user.create({
        data: {
          phone: dto.phone,
          email: this.phoneToPseudoEmail(dto.phone),
          username: dto.username,
          displayName: dto.displayName,
          passwordHash: '', // нет пароля у phone-only — логин только через SMS
          isVerified: true,
        },
      });
    }

    if (user.totpEnabled) {
      // 2FA-ход не нужно дублировать поверх SMS — это и есть второй фактор.
      // Намеренно скипаем здесь, иначе UX превращается в кашу.
    }

    return this.issueTokens(user.id);
  }

  private phoneToPseudoEmail(phone: string): string {
    return `${phone.replace(/[^0-9]/g, '')}@phone.crabogram.local`;
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
