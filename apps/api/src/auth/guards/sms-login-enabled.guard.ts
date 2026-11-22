import { CanActivate, HttpStatus, Injectable } from '@nestjs/common';
import { SettingsService } from '../../settings/settings.service';
import { AppError } from '../../common/errors/app-error';
import { ErrorCode } from '../../common/errors/error-codes';

/**
 * SMS/OTP login stays in the code but is switched off unless
 * SMS_LOGIN_ENABLED=true — used while the SMS provider is unavailable.
 */
export async function isSmsLoginEnabled(
  settings: SettingsService,
): Promise<boolean> {
  return (await settings.get('sms.loginEnabled')) === 'true';
}

@Injectable()
export class SmsLoginEnabledGuard implements CanActivate {
  constructor(private readonly settings: SettingsService) {}

  async canActivate(): Promise<boolean> {
    if (!(await isSmsLoginEnabled(this.settings))) {
      throw new AppError(
        ErrorCode.SMS_LOGIN_DISABLED,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return true;
  }
}
