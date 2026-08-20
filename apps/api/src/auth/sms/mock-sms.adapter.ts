import { Injectable, Logger } from '@nestjs/common';
import { maskPhone } from '../../common/utils/mask-phone';
import type { SmsPort, SmsSendResult } from './sms.port';

@Injectable()
export class MockSmsAdapter implements SmsPort {
  private readonly logger = new Logger(MockSmsAdapter.name);

  sendOtp(phone: string, code: string): Promise<SmsSendResult> {
    if (process.env.NODE_ENV !== 'production') {
      this.logger.log(`[mock-sms] OTP for ${maskPhone(phone)}: ${code}`);
    } else {
      this.logger.log(`[mock-sms] OTP requested for ${maskPhone(phone)}`);
    }
    return Promise.resolve({ delivered: true });
  }

  sendNotification(
    phone: string,
    templateId: string,
    params: Record<string, string>,
  ): Promise<SmsSendResult> {
    this.logger.log(
      `[mock-sms] notification "${templateId}" for ${maskPhone(phone)}: ${JSON.stringify(params)}`,
    );
    return Promise.resolve({ delivered: true });
  }
}
