import { CanActivate, HttpStatus, Injectable } from '@nestjs/common';
import { AppError } from '../../common/errors/app-error';
import { ErrorCode } from '../../common/errors/error-codes';
import { DynamicSmsAdapter } from '../sms/dynamic-sms.adapter';

/**
 * Refuses an OTP request up front when no SMS can actually be sent (a fresh
 * server before the admin configured sms.ir). Without this the login page
 * would say "code sent" while nothing leaves the server.
 */
@Injectable()
export class SmsConfiguredGuard implements CanActivate {
  constructor(private readonly sms: DynamicSmsAdapter) {}

  async canActivate(): Promise<boolean> {
    if (!(await this.sms.isConfigured())) {
      throw new AppError(
        ErrorCode.SMS_NOT_CONFIGURED,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return true;
  }
}
