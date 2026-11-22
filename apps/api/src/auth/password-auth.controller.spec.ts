import { ErrorCode } from '../common/errors/error-codes';
import { PasswordAuthController } from './password-auth.controller';

describe('SMS-first auth methods', () => {
  function make(enabled: boolean) {
    return new PasswordAuthController(
      {} as never,
      {} as never,
      {} as never,
      {
        get: () => Promise.resolve(String(enabled)),
      } as never,
    );
  }

  it('advertises SMS while preserving legacy password login', async () => {
    await expect(make(true).methods()).resolves.toEqual({
      password: true,
      sms: true,
    });
    await expect(make(false).methods()).resolves.toEqual({
      password: true,
      sms: false,
    });
  });

  it('rejects new password registrations', () => {
    try {
      make(true).register({
        email: 'new@example.com',
        password: 'Example123',
        formToken: 'example-token',
      });
      throw new Error('expected registration to be rejected');
    } catch (error) {
      expect(error).toMatchObject({
        code: ErrorCode.SMS_REGISTRATION_REQUIRED,
      });
    }
  });
});
