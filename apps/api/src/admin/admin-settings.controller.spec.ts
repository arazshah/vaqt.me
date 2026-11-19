import { prisma } from '@vaqt/db';
import { AuditService } from '../auth/audit/audit.service';
import type { SmsPort } from '../auth/sms/sms.port';
import { ErrorCode } from '../common/errors/error-codes';
import { fakeConfig } from '../test-support/fake-config';
import { SettingsService } from '../settings/settings.service';
import { MemorySettingsStore } from '../settings/settings.store';
import { AdminSettingsController } from './admin-settings.controller';

const ACTOR = { sub: 'admin-user-1', sid: 's1' };

function make(env: Record<string, string> = {}) {
  const cfg = fakeConfig({ APP_SECRET: 'm'.repeat(40), ...env });
  const settings = new SettingsService(cfg, new MemorySettingsStore());
  const sms = {
    sendOtp: jest.fn().mockResolvedValue({ delivered: true }),
    sendNotification: jest.fn(),
  } as unknown as SmsPort & { sendOtp: jest.Mock };
  const audit = new AuditService();
  const logSpy = jest.spyOn(audit, 'log').mockResolvedValue();
  return {
    controller: new AdminSettingsController(settings, audit, cfg, sms),
    settings,
    sms,
    logSpy,
  };
}

describe('AdminSettingsController', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });
  afterAll(() => prisma.$disconnect());

  it('lists every setting without ever exposing a secret value', async () => {
    const { controller, settings } = make();
    await settings.update(
      { set: { 'sms.smsir.apiKey': 'SECRET-KEY-123' }, clear: [] },
      'a',
    );
    const { settings: list } = await controller.list();
    expect(list.length).toBeGreaterThan(8);
    expect(list.find((s) => s.key === 'sms.smsir.apiKey')).toMatchObject({
      value: null,
      isSet: true,
    });
    expect(JSON.stringify(list)).not.toContain('SECRET-KEY-123');
  });

  it('updates, audits only the key names, and returns the fresh list', async () => {
    const { controller, logSpy } = make();
    const res = await controller.update(ACTOR, {
      set: { 'sms.smsir.apiKey': 'SECRET-KEY-123', 'sms.provider': 'smsir' },
      clear: [],
    });
    expect(res.changed.sort()).toEqual(['sms.provider', 'sms.smsir.apiKey']);
    const logged = JSON.stringify(logSpy.mock.calls);
    expect(logged).toContain('admin.settings.update');
    expect(logged).not.toContain('SECRET-KEY-123');
  });

  it('turns a validation problem into SETTING_INVALID with the offending key', async () => {
    const { controller, logSpy } = make();
    await expect(
      controller.update(ACTOR, {
        set: { 'sms.smsir.otpTemplateId': 'abc' },
        clear: [],
      }),
    ).rejects.toMatchObject({
      status: 400,
      response: {
        code: ErrorCode.SETTING_INVALID,
        details: { key: 'sms.smsir.otpTemplateId', reason: 'invalid' },
      },
    });
    expect(logSpy).not.toHaveBeenCalled();
  });

  describe('bale/connect', () => {
    it('verifies the token, saves the bot username and registers the secret webhook URL', async () => {
      const calls: { url: string; body: unknown }[] = [];
      global.fetch = jest.fn((url: string, init: { body: string }) => {
        calls.push({ url, body: JSON.parse(init.body) });
        const result = url.endsWith('/getMe') ? { username: 'vaqt_bot' } : true;
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ ok: true, result }),
        });
      }) as unknown as typeof fetch;
      const { controller, settings } = make({ WEB_ORIGIN: 'https://vaqt.me' });
      await settings.update(
        { set: { 'bale.botToken': '123:ABC' }, clear: [] },
        'a',
      );

      const res = await controller.connectBale(ACTOR);
      expect(res).toEqual({ ok: true, username: 'vaqt_bot' });
      expect(await settings.get('bale.botUsername')).toBe('vaqt_bot');
      const secret = await settings.get('bale.webhookSecret');
      const hook = calls.find((c) => c.url.endsWith('/setWebhook'));
      expect(hook?.body).toEqual({
        url: `https://vaqt.me/api/v1/messenger/bale/webhook/${String(secret)}`,
      });
      expect(
        calls.every((c) =>
          c.url.startsWith('https://tapi.bale.ai/bot123:ABC/'),
        ),
      ).toBe(true);
      expect(secret).toBeDefined();
      expect(JSON.stringify(res)).not.toContain(String(secret)); // the secret never goes back to the browser
    });

    it('fails clearly without a token, over plain http, or when Bale refuses the token', async () => {
      const noToken = make({ WEB_ORIGIN: 'https://vaqt.me' });
      await expect(noToken.controller.connectBale(ACTOR)).rejects.toMatchObject(
        { response: { code: ErrorCode.INTEGRATION_FAILED } },
      );

      const http = make({ WEB_ORIGIN: 'http://vaqt.me' });
      await http.settings.update(
        { set: { 'bale.botToken': '123:ABC' }, clear: [] },
        'a',
      );
      await expect(http.controller.connectBale(ACTOR)).rejects.toMatchObject({
        response: { code: ErrorCode.INTEGRATION_FAILED },
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ ok: false, description: 'Unauthorized' }),
      });
      const bad = make({ WEB_ORIGIN: 'https://vaqt.me' });
      await bad.settings.update(
        { set: { 'bale.botToken': 'wrong' }, clear: [] },
        'a',
      );
      await expect(bad.controller.connectBale(ACTOR)).rejects.toMatchObject({
        status: 502,
      });
    });
  });

  describe('sms/test', () => {
    it('sends one OTP-style message to the normalised number and audits it masked', async () => {
      const { controller, sms, logSpy } = make();
      expect(
        await controller.testSms(ACTOR, { phone: '0912 345 6747' }),
      ).toEqual({ delivered: true });
      expect(sms.sendOtp).toHaveBeenCalledWith(
        '+989123456747',
        expect.stringMatching(/^\d{5}$/),
      );
      expect(JSON.stringify(logSpy.mock.calls)).not.toContain('9123456747');
    });

    it('rejects a number that is not an Iranian mobile', async () => {
      const { controller, sms } = make();
      await expect(
        controller.testSms(ACTOR, { phone: '12345' }),
      ).rejects.toMatchObject({
        response: { code: ErrorCode.VALIDATION_ERROR },
      });
      expect(sms.sendOtp).not.toHaveBeenCalled();
    });
  });
});
