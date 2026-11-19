import { CanActivate, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppError } from '../../common/errors/app-error';
import { ErrorCode } from '../../common/errors/error-codes';

/**
 * SMS/OTP login stays in the code but is switched off unless
 * SMS_LOGIN_ENABLED=true — used while the SMS provider is unavailable.
 */
export function isSmsLoginEnabled(config: ConfigService): boolean {
  return config.get<string>('SMS_LOGIN_ENABLED') === 'true';
}

@Injectable()
export class SmsLoginEnabledGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(): boolean {
    if (!isSmsLoginEnabled(this.config)) {
      throw new AppError(
        ErrorCode.SMS_LOGIN_DISABLED,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return true;
  }
}
