import type { SettingsService } from '../../settings/settings.service';
import { DynamicSmsAdapter } from './dynamic-sms.adapter';

function make(values: Record<string, string>) {
  return new DynamicSmsAdapter({
    get: (k: string) => Promise.resolve(values[k]),
  } as unknown as SettingsService);
}

describe('DynamicSmsAdapter', () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env.NODE_ENV;
  afterEach(() => {
    global.fetch = originalFetch;
    process.env.NODE_ENV = originalEnv;
  });

  it('sends nothing, and says so, when the provider is disabled', async () => {
    global.fetch = jest.fn();
    expect(
      await make({ 'sms.provider': 'disabled' }).sendOtp(
        '+989123456747',
        '12345',
      ),
    ).toEqual({ delivered: false });
    expect(await make({}).sendNotification('+989123456747', '1', {})).toEqual({
      delivered: false,
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('uses the mock outside production but refuses it in production', async () => {
    process.env.NODE_ENV = 'development';
    expect(
      await make({ 'sms.provider': 'mock' }).sendOtp('+989123456747', '12345'),
    ).toEqual({ delivered: true });
    process.env.NODE_ENV = 'production';
    expect(
      await make({ 'sms.provider': 'mock' }).sendOtp('+989123456747', '12345'),
    ).toEqual({ delivered: false });
  });

  it('does not pretend to send with sms.ir when the key or OTP template is missing', async () => {
    global.fetch = jest.fn();
    expect(
      await make({ 'sms.provider': 'smsir', 'sms.smsir.apiKey': 'k' }).sendOtp(
        '+989123456747',
        '1',
      ),
    ).toEqual({ delivered: false });
    expect(
      await make({
        'sms.provider': 'smsir',
        'sms.smsir.otpTemplateId': '5',
      }).sendOtp('+989123456747', '1'),
    ).toEqual({ delivered: false });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('calls sms.ir with the key and template from the panel, and picks up changes on the next send', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock;
    const values: Record<string, string> = {
      'sms.provider': 'smsir',
      'sms.smsir.apiKey': 'KEY-1',
      'sms.smsir.otpTemplateId': '100',
    };
    const adapter = new DynamicSmsAdapter({
      get: (k: string) => Promise.resolve(values[k]),
    } as unknown as SettingsService);
    expect(await adapter.sendOtp('+989123456747', '55555')).toEqual({
      delivered: true,
    });
    const [, init] = fetchMock.mock.calls[0] as [
      string,
      { headers: Record<string, string>; body: string },
    ];
    expect(init.headers['x-api-key']).toBe('KEY-1');
    expect(JSON.parse(init.body)).toMatchObject({
      mobile: '09123456747',
      templateId: 100,
    });

    values['sms.smsir.apiKey'] = 'KEY-2'; // admin pastes a new key: no restart needed
    await adapter.sendOtp('+989123456747', '55555');
    const [, init2] = fetchMock.mock.calls[1] as [
      string,
      { headers: Record<string, string> },
    ];
    expect(init2.headers['x-api-key']).toBe('KEY-2');
  });
});
