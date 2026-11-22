import type { SettingsService } from '../../settings/settings.service';
import { ErrorCode } from '../../common/errors/error-codes';
import { SmsLoginEnabledGuard } from './sms-login-enabled.guard';

const guardWith = (value: string | undefined) =>
  new SmsLoginEnabledGuard({
    get: () => Promise.resolve(value),
  } as unknown as SettingsService);

describe('SmsLoginEnabledGuard', () => {
  it('rejects missing or disabled settings', async () => {
    await expect(guardWith(undefined).canActivate()).rejects.toThrow();
    await expect(guardWith('false').canActivate()).rejects.toThrow();
  });

  it('answers 503 SMS_LOGIN_DISABLED', async () => {
    await expect(guardWith(undefined).canActivate()).rejects.toMatchObject({
      status: 503,
      response: { code: ErrorCode.SMS_LOGIN_DISABLED },
    });
  });

  it('lets OTP requests through only when enabled', async () => {
    await expect(guardWith('true').canActivate()).resolves.toBe(true);
  });
});
