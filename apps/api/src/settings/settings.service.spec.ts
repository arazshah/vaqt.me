import { prisma } from '@vaqt/db';
import { fakeConfig } from '../test-support/fake-config';
import { SettingsService, SettingsValidationError } from './settings.service';
import { PrismaSettingsStore } from './settings.store';

const MASTER = 'm'.repeat(40);
// These specs only touch keys no other suite reads, so they can run in
// parallel with the rest.
const KEYS = [
  'sms.provider',
  'sms.smsir.apiKey',
  'sms.smsir.otpTemplateId',
  'bale.botUsername',
  'bale.webhookSecret',
];

function make(env: Record<string, string> = {}) {
  return new SettingsService(
    fakeConfig({ APP_SECRET: MASTER, ...env }),
    new PrismaSettingsStore(),
  );
}

describe('SettingsService (real Postgres)', () => {
  const clean = () =>
    prisma.appSetting.deleteMany({ where: { key: { in: KEYS } } });
  beforeEach(clean);
  afterAll(async () => {
    await clean();
    await prisma.$disconnect();
  });

  it('resolves panel > env > default, and reports where a value came from', async () => {
    const s = make({ SMSIR_VERIFY_TEMPLATE_ID: '111' });
    expect(await s.get('sms.provider')).toBe('mock'); // default outside production
    expect((await s.list()).find((v) => v.key === 'sms.provider')?.source).toBe(
      'default',
    );
    expect(await s.get('sms.smsir.otpTemplateId')).toBe('111'); // env

    await s.update(
      { set: { 'sms.smsir.otpTemplateId': '222' }, clear: [] },
      'admin1',
    );
    expect(await s.get('sms.smsir.otpTemplateId')).toBe('222'); // panel wins at once
    expect(
      (await s.list()).find((v) => v.key === 'sms.smsir.otpTemplateId')?.source,
    ).toBe('panel');

    await s.update({ set: {}, clear: ['sms.smsir.otpTemplateId'] }, 'admin1');
    expect(await s.get('sms.smsir.otpTemplateId')).toBe('111'); // back to env
  });

  it('providers default to "disabled" in production', async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      expect(await make().get('sms.provider')).toBe('disabled');
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it('stores secrets encrypted and never returns them', async () => {
    const s = make();
    await s.update(
      { set: { 'sms.smsir.apiKey': 'my-real-api-key' }, clear: [] },
      'admin1',
    );
    const raw = await prisma.appSetting.findUniqueOrThrow({
      where: { key: 'sms.smsir.apiKey' },
    });
    expect(raw.isSecret).toBe(true);
    expect(raw.value).not.toContain('my-real-api-key');
    expect(await s.get('sms.smsir.apiKey')).toBe('my-real-api-key');
    const view = (await s.list()).find((v) => v.key === 'sms.smsir.apiKey');
    expect(view).toMatchObject({ value: null, isSet: true, kind: 'secret' });
    expect(JSON.stringify(await s.list())).not.toContain('my-real-api-key');
  });

  it('an empty value for a secret keeps the stored one; clear removes it', async () => {
    const s = make();
    await s.update(
      { set: { 'sms.smsir.apiKey': 'keep-me' }, clear: [] },
      'admin1',
    );
    await s.update({ set: { 'sms.smsir.apiKey': '' }, clear: [] }, 'admin1');
    expect(await s.get('sms.smsir.apiKey')).toBe('keep-me');
    await s.update({ set: {}, clear: ['sms.smsir.apiKey'] }, 'admin1');
    expect(await s.get('sms.smsir.apiKey')).toBeUndefined();
  });

  it('rejects unknown keys, bad formats and non-options, and writes nothing when any value is bad', async () => {
    const s = make();
    await expect(
      s.update({ set: { 'nope.key': 'x' }, clear: [] }, 'a'),
    ).rejects.toMatchObject({ reason: 'unknown_key' });
    await expect(
      s.update({ set: { 'sms.provider': 'carrier-pigeon' }, clear: [] }, 'a'),
    ).rejects.toMatchObject({ reason: 'not_an_option' });
    await expect(
      s.update({ set: { 'sms.smsir.otpTemplateId': '12ab' }, clear: [] }, 'a'),
    ).rejects.toBeInstanceOf(SettingsValidationError);
    await expect(
      s.update(
        {
          set: { 'sms.smsir.otpTemplateId': '555', 'sms.provider': 'bogus' },
          clear: [],
        },
        'a',
      ),
    ).rejects.toBeDefined();
    expect(
      await prisma.appSetting.count({ where: { key: { in: KEYS } } }),
    ).toBe(0);
  });

  it('reports only key names as changed (never values)', async () => {
    const changed = await make().update(
      {
        set: { 'sms.smsir.apiKey': 'topsecret', 'sms.provider': 'smsir' },
        clear: [],
      },
      'admin1',
    );
    expect(changed.sort()).toEqual(['sms.provider', 'sms.smsir.apiKey']);
    expect(JSON.stringify(changed)).not.toContain('topsecret');
  });

  it('treats a secret it cannot decrypt (APP_SECRET changed) as unset instead of crashing', async () => {
    await make().update(
      { set: { 'sms.smsir.apiKey': 'old-key' }, clear: [] },
      'admin1',
    );
    const rotated = new SettingsService(
      fakeConfig({ APP_SECRET: 'z'.repeat(40) }),
      new PrismaSettingsStore(),
    );
    await expect(rotated.get('sms.smsir.apiKey')).resolves.toBeUndefined();
  });

  it('strips a leading @ from the bot username and generates a stable webhook secret once', async () => {
    const s = make();
    await s.update({ set: { 'bale.botUsername': '@my_bot' }, clear: [] }, 'a');
    expect(await s.get('bale.botUsername')).toBe('my_bot');
    const first = await s.ensureWebhookSecret('a');
    expect(first.length).toBeGreaterThanOrEqual(16);
    expect(await s.ensureWebhookSecret('a')).toBe(first);
  });
});
