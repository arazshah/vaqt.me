import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { maskPhone } from '../../common/utils/mask-phone';
import type { SmsPort, SmsSendResult } from './sms.port';

const SMSIR_VERIFY_ENDPOINT = 'https://api.sms.ir/v1/send/verify';

interface SmsIrParameter {
  name: string;
  value: string;
}

/**
 * sms.ir's "pattern/verify" API — sends a templated message (OTP or
 * notification) by template id with named parameters, rather than free
 * text. See https://sms.ir for the current API reference; the shape below
 * matches their documented v1 verify endpoint.
 */
@Injectable()
export class SmsIrAdapter implements SmsPort {
  private readonly logger = new Logger(SmsIrAdapter.name);
  private readonly apiKey: string;
  private readonly otpTemplateId: string;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('SMSIR_API_KEY');
    const otpTemplateId = config.get<string>('SMSIR_VERIFY_TEMPLATE_ID');
    if (!apiKey || !otpTemplateId) {
      throw new Error(
        'SMSIR_API_KEY and SMSIR_VERIFY_TEMPLATE_ID must be set when SMS_PROVIDER=smsir',
      );
    }
    this.apiKey = apiKey;
    this.otpTemplateId = otpTemplateId;
  }

  async sendOtp(phone: string, code: string): Promise<SmsSendResult> {
    return this.send(phone, this.otpTemplateId, [
      { name: 'CODE', value: code },
    ]);
  }

  async sendNotification(
    phone: string,
    templateId: string,
    params: Record<string, string>,
  ): Promise<SmsSendResult> {
    const parameters = Object.entries(params).map(([name, value]) => ({
      name,
      value,
    }));
    return this.send(phone, templateId, parameters);
  }

  private async send(
    phone: string,
    templateId: string,
    parameters: SmsIrParameter[],
  ): Promise<SmsSendResult> {
    const mobile = phone.replace('+98', '0');
    try {
      const response = await fetch(SMSIR_VERIFY_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'x-api-key': this.apiKey,
        },
        body: JSON.stringify({
          mobile,
          templateId: Number(templateId),
          parameters,
        }),
      });

      if (!response.ok) {
        this.logger.error(
          `[sms.ir] send failed for ${maskPhone(phone)}: HTTP ${String(response.status)}`,
        );
        return { delivered: false };
      }

      return { delivered: true };
    } catch (error) {
      this.logger.error(`[sms.ir] send threw for ${maskPhone(phone)}`, error);
      return { delivered: false };
    }
  }
}
