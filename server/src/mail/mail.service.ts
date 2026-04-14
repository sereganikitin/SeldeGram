import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;

  constructor(config: ConfigService) {
    const port = parseInt(config.get<string>('SMTP_PORT', '1025'), 10);
    this.transporter = nodemailer.createTransport({
      host: config.get<string>('SMTP_HOST', 'localhost'),
      port,
      secure: port === 465, // SSL для 465, STARTTLS для 587
      auth: config.get<string>('SMTP_USER')
        ? {
            user: config.get<string>('SMTP_USER'),
            pass: config.get<string>('SMTP_PASS'),
          }
        : undefined,
    });
    this.from = config.get<string>('SMTP_FROM', 'no-reply@seldegram.local');
  }

  async sendVerificationCode(email: string, code: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: email,
      subject: 'CraboGram — код подтверждения',
      text: `Ваш код подтверждения: ${code}\n\nКод действителен 15 минут.`,
      html: `<p>Ваш код подтверждения: <b>${code}</b></p><p>Код действителен 15 минут.</p>`,
    });
    this.logger.log(`Verification code sent to ${email}`);
  }

  async sendPasswordResetCode(email: string, code: string): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: email,
      subject: 'CraboGram — восстановление пароля',
      text: `Код для восстановления пароля: ${code}\n\nКод действителен 15 минут. Если вы не запрашивали восстановление, проигнорируйте это письмо.`,
      html: `<p>Код для восстановления пароля: <b>${code}</b></p><p>Код действителен 15 минут. Если вы не запрашивали восстановление, проигнорируйте это письмо.</p>`,
    });
    this.logger.log(`Password reset code sent to ${email}`);
  }
}
