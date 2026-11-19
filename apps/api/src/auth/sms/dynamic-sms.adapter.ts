import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../../settings/settings.service';
import { maskPhone } from '../../common/utils/mask-phone';
import { MockSmsAdapter } from './mock-sms.adapter';
import { SmsIrAdapter } from './sms-ir.adapter';
import type { SmsPort, SmsSendResult } from './sms.port';

/**
 * The SmsPort the app actually uses: it looks at the admin-panel settings on
 * every send, so switching provider or pasting a new API key applies at once
 * without a restart.
 *
 * - disabled: nothing is sent, and that is logged (an unconfigured production
 *   server must not pretend an OTP went out).
 * - mock: only outside production (it just logs the code).
 */
@Injectable()
export class DynamicSmsAdapter implements SmsPort {
  private readonly logger = new Logger(DynamicSmsAdapter.name);
  private readonly mock = new MockSmsAdapter();

  constructor(private readonly settings: SettingsService) {}

  private async resolve(): Promise<SmsPort | null> {
    const provider = (await this.settings.get('sms.provider')) ?? 'disabled';

    if (provider === 'smsir') {
      const apiKey = await this.settings.get('sms.smsir.apiKey');
      const otpTemplateId = await this.settings.get('sms.smsir.otpTemplateId');
      if (!apiKey || !otpTemplateId) {
        this.logger.error(
          'sms.provider is "smsir" but the API key or OTP template id is missing in the admin panel',
        );
        return null;
      }
      return new SmsIrAdapter({
        get: (key) =>
          key === 'SMSIR_API_KEY'
            ? apiKey
            : key === 'SMSIR_VERIFY_TEMPLATE_ID'
              ? otpTemplateId
              : undefined,
      });
    }

    if (provider === 'mock') {
      if (process.env.NODE_ENV === 'production') {
        this.logger.error(
          'sms.provider is "mock" in production: no SMS is sent. Configure sms.ir in the admin panel.',
        );
        return null;
      }
      return this.mock;
    }

    return null;
  }

  /** False when nothing could be sent right now (disabled, missing key, mock in production). */
  async isConfigured(): Promise<boolean> {
    return (await this.resolve()) !== null;
  }

  async sendOtp(phone: string, code: string): Promise<SmsSendResult> {
    const adapter = await this.resolve();
    if (!adapter) {
      this.logger.warn(
        `OTP for ${maskPhone(phone)} not sent: SMS is not configured`,
      );
      return { delivered: false };
    }
    return adapter.sendOtp(phone, code);
  }

  async sendNotification(
    phone: string,
    templateId: string,
    params: Record<string, string>,
  ): Promise<SmsSendResult> {
    const adapter = await this.resolve();
    if (!adapter) {
      this.logger.warn(
        `SMS to ${maskPhone(phone)} not sent: SMS is not configured`,
      );
      return { delivered: false };
    }
    return adapter.sendNotification(phone, templateId, params);
  }
}
