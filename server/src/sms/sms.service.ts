import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface SmsRuResponse {
  status: 'OK' | 'ERROR';
  status_code: number;
  status_text?: string;
  sms?: Record<
    string,
    { status: 'OK' | 'ERROR'; status_code: number; status_text?: string; sms_id?: string }
  >;
  balance?: number;
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

      // Верхний статус "OK" значит только то, что запрос был принят — не что
      // SMS реально доставлена. Проверяем под-статус для конкретного номера.
      if (data.status !== 'OK') {
        this.logger.error(
          `SMS.ru rejected request: ${data.status_code} ${data.status_text ?? ''}`,
        );
        return false;
      }
      const per = data.sms?.[to];
      if (per && per.status !== 'OK') {
        this.logger.error(
          `SMS.ru rejected delivery to ${phone}: ${per.status_code} ${per.status_text ?? ''} (balance: ${data.balance})`,
        );
        return false;
      }
      this.logger.log(`SMS sent to ${phone} (balance left: ${data.balance})`);
      return true;
    } catch (e) {
      this.logger.error(`SMS.ru fetch error: ${(e as Error).message}`);
      return false;
    }
  }
}
