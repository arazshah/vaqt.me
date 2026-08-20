import { fakeConfig } from '../../test-support/fake-config';
import { SmsIrAdapter } from './sms-ir.adapter';

function makeAdapter(): SmsIrAdapter {
  return new SmsIrAdapter(
    fakeConfig({
      SMSIR_API_KEY: 'test-key',
      SMSIR_VERIFY_TEMPLATE_ID: '12345',
    }),
  );
}

describe('SmsIrAdapter', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('throws at construction if SMSIR_API_KEY is missing', () => {
    expect(
      () => new SmsIrAdapter(fakeConfig({ SMSIR_VERIFY_TEMPLATE_ID: '12345' })),
    ).toThrow(
      'SMSIR_API_KEY and SMSIR_VERIFY_TEMPLATE_ID must be set when SMS_PROVIDER=smsir',
    );
  });

  it('throws at construction if SMSIR_VERIFY_TEMPLATE_ID is missing', () => {
    expect(
      () => new SmsIrAdapter(fakeConfig({ SMSIR_API_KEY: 'test-key' })),
    ).toThrow(
      'SMSIR_API_KEY and SMSIR_VERIFY_TEMPLATE_ID must be set when SMS_PROVIDER=smsir',
    );
  });

  it('sendOtp posts the code as a CODE parameter against the configured template', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock;

    const result = await makeAdapter().sendOtp('+989123456789', '54321');

    expect(result).toEqual({ delivered: true });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('sms.ir');
    const body = JSON.parse(init.body as string) as {
      mobile: string;
      templateId: number;
      parameters: { name: string; value: string }[];
    };
    expect(body.mobile).toBe('09123456789');
    expect(body.templateId).toBe(12345);
    expect(body.parameters).toEqual([{ name: 'CODE', value: '54321' }]);
  });

  it('sendNotification posts arbitrary named parameters against the given template', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock;

    const result = await makeAdapter().sendNotification(
      '+989123456789',
      '999',
      {
        offerCount: '3',
      },
    );

    expect(result).toEqual({ delivered: true });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as {
      templateId: number;
      parameters: { name: string; value: string }[];
    };
    expect(body.templateId).toBe(999);
    expect(body.parameters).toEqual([{ name: 'offerCount', value: '3' }]);
  });

  it('returns delivered: false when the API responds with a non-OK status', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 400 });
    const result = await makeAdapter().sendOtp('+989123456789', '54321');
    expect(result).toEqual({ delivered: false });
  });

  it('returns delivered: false when fetch itself throws (network error)', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'));
    const result = await makeAdapter().sendOtp('+989123456789', '54321');
    expect(result).toEqual({ delivered: false });
  });
});
