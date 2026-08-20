import { MockSmsAdapter } from './mock-sms.adapter';

describe('MockSmsAdapter', () => {
  afterEach(() => {
    delete process.env.NODE_ENV;
  });

  it('sendOtp resolves with delivered: true', async () => {
    process.env.NODE_ENV = 'development';
    const adapter = new MockSmsAdapter();
    await expect(adapter.sendOtp('+989123456789', '12345')).resolves.toEqual({
      delivered: true,
    });
  });

  it('sendOtp does not throw in production (just logs without the code)', async () => {
    process.env.NODE_ENV = 'production';
    const adapter = new MockSmsAdapter();
    await expect(adapter.sendOtp('+989123456789', '12345')).resolves.toEqual({
      delivered: true,
    });
  });

  it('sendNotification resolves with delivered: true', async () => {
    const adapter = new MockSmsAdapter();
    await expect(
      adapter.sendNotification('+989123456789', 'welcome', { name: 'تست' }),
    ).resolves.toEqual({ delivered: true });
  });
});
