import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface SmsRuResponse {
  status: 'OK' | 'ERROR';
  status_code: number;
  status_text?: string;
  sms?: Record<string, { status: string; status_code: number; sms_id?: string }>;
}

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly apiId: string;
  private readonly from: string | undefined;
  private readonly devMode: boolean;

  constructor(config: ConfigService) {
    this.apiId = config.get<string>('SMS_RU_API_ID', '');
    this.from = config.get<string>('SMS_RU_FROM') || undefined;
    this.devMode = !this.apiId;
    if (this.devMode) {
      this.logger.warn(
        'SMS_RU_API_ID is not set — SMS-коды печатаются в лог вместо реальной отправки',
      );
    }
  }

  /**
   * Отправить SMS с OTP-кодом.
   * Возвращает true при успешной доставке (или dev-логировании).
   * В dev-режиме код выводится в лог сервера.
   */
  async sendOtp(phone: string, code: string): Promise<boolean> {
    const msg = `${code} — код подтверждения CraboGram`;

    if (this.devMode) {
      this.logger.log(`[DEV] SMS to ${phone}: ${msg}`);
      return true;
    }

    // SMS.ru принимает номер без +
    const to = phone.replace(/^\+/, '');

    const params = new URLSearchParams({
      api_id: this.apiId,
      to,
      msg,
      json: '1',
    });
    if (this.from) params.set('from', this.from);

    try {
      const resp = await fetch(`https://sms.ru/sms/send?${params.toString()}`);
      const data = (await resp.json()) as SmsRuResponse;
      if (data.status === 'OK') {
        this.logger.log(`SMS sent to ${phone}`);
        return true;
      }
      this.logger.error(`SMS.ru rejected: ${data.status_code} ${data.status_text}`);
      return false;
    } catch (e) {
      this.logger.error(`SMS.ru fetch error: ${(e as Error).message}`);
      return false;
    }
  }
}
