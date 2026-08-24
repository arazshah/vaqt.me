import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PaymentsConfigService {
  readonly provider: string;
  readonly webOrigin: string;
  readonly callbackUrl: string;
  readonly reconciliationStaleMinutes: number;

  constructor(config: ConfigService) {
    this.provider = config.get<string>('PAYMENT_PROVIDER') ?? 'mock';
    this.webOrigin =
      config.get<string>('WEB_ORIGIN') ?? 'http://localhost:3000';
    this.callbackUrl =
      config.get<string>('ZARINPAL_CALLBACK_URL') ??
      'http://localhost:3001/api/v1/payments/zarinpal/callback';
    this.reconciliationStaleMinutes = 30;
  }
}
