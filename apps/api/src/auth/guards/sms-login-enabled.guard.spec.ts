import type { ConfigService } from '@nestjs/config';
import { ErrorCode } from '../../common/errors/error-codes';
import { SmsLoginEnabledGuard } from './sms-login-enabled.guard';

const guardWith = (value: string | undefined) =>
  new SmsLoginEnabledGuard({
    get: () => value,
  } as unknown as ConfigService);

describe('SmsLoginEnabledGuard', () => {
  it('is off by default (SMS login disabled)', () => {
    expect(() => guardWith(undefined).canActivate()).toThrow();
    expect(() => guardWith('false').canActivate()).toThrow();
  });

  it('answers 503 SMS_LOGIN_DISABLED', () => {
    try {
      guardWith(undefined).canActivate();
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toMatchObject({
        status: 503,
        response: { code: ErrorCode.SMS_LOGIN_DISABLED },
      });
    }
  });

  it('lets OTP requests through only when SMS_LOGIN_ENABLED=true', () => {
    expect(guardWith('true').canActivate()).toBe(true);
  });
});
