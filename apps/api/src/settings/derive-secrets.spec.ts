import { deriveMissingSecrets } from './derive-secrets';

const APP = 'a'.repeat(48);
const NAMES = [
  'OTP_PEPPER',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
] as const;

describe('deriveMissingSecrets', () => {
  it('fills all three secrets from APP_SECRET: long, distinct and deterministic', () => {
    const a = deriveMissingSecrets({ APP_SECRET: APP });
    const b = deriveMissingSecrets({ APP_SECRET: APP });
    const values = NAMES.map((n) => a[n] ?? '');
    for (const v of values) expect(v).toMatch(/^[0-9a-f]{64}$/);
    expect(new Set(values).size).toBe(3);
    expect(values).toEqual(NAMES.map((n) => b[n]));
    expect(values.join('')).not.toContain(APP);
  });

  it('a different APP_SECRET gives different secrets', () => {
    const a = deriveMissingSecrets({ APP_SECRET: APP });
    const b = deriveMissingSecrets({ APP_SECRET: 'b'.repeat(48) });
    expect(a.JWT_ACCESS_SECRET).not.toBe(b.JWT_ACCESS_SECRET);
  });

  it('never overrides a value set explicitly', () => {
    const env = deriveMissingSecrets({
      APP_SECRET: APP,
      OTP_PEPPER: 'explicit-pepper-value',
    });
    expect(env.OTP_PEPPER).toBe('explicit-pepper-value');
    expect(env.JWT_ACCESS_SECRET).toMatch(/^[0-9a-f]{64}$/);
  });

  it('does nothing without APP_SECRET or with a too-short one', () => {
    expect(deriveMissingSecrets({}).OTP_PEPPER).toBeUndefined();
    expect(
      deriveMissingSecrets({ APP_SECRET: 'short' }).OTP_PEPPER,
    ).toBeUndefined();
  });
});
