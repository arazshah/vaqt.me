import type { DynamicSmsAdapter } from '../sms/dynamic-sms.adapter';
import { ErrorCode } from '../../common/errors/error-codes';
import { SmsConfiguredGuard } from './sms-configured.guard';

const guardWith = (configured: boolean) =>
  new SmsConfiguredGuard({
    isConfigured: () => Promise.resolve(configured),
  } as unknown as DynamicSmsAdapter);

describe('SmsConfiguredGuard', () => {
  it('lets the request through when SMS can be sent', async () => {
    await expect(guardWith(true).canActivate()).resolves.toBe(true);
  });

  it('answers 503 SMS_NOT_CONFIGURED when it cannot', async () => {
    await expect(guardWith(false).canActivate()).rejects.toMatchObject({
      status: 503,
      response: { code: ErrorCode.SMS_NOT_CONFIGURED },
    });
  });
});
