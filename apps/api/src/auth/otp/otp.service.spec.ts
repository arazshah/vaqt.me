import { fakeConfig } from '../../test-support/fake-config';
import { OtpService } from './otp.service';

function makeService(overrides: Record<string, string> = {}): OtpService {
  return new OtpService(
    fakeConfig({ OTP_PEPPER: 'test-pepper', ...overrides }),
  );
}

describe('OtpService', () => {
  it('throws at construction if OTP_PEPPER is missing', () => {
    expect(() => new OtpService(fakeConfig({}))).toThrow(
      'OTP_PEPPER must be set',
    );
  });

  it('generates a 5-digit numeric code', () => {
    const service = makeService();
    const code = service.generateCode();
    expect(code).toMatch(/^\d{5}$/);
  });

  it('generates different codes across calls (not deterministic)', () => {
    const service = makeService();
    const codes = new Set(
      Array.from({ length: 20 }, () => service.generateCode()),
    );
    expect(codes.size).toBeGreaterThan(1);
  });

  it('returns DEV_FIXED_OTP outside production when set', () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const service = makeService({ DEV_FIXED_OTP: '11111' });
    expect(service.generateCode()).toBe('11111');
    process.env.NODE_ENV = original;
  });

  it('ignores DEV_FIXED_OTP in production', () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const service = makeService({ DEV_FIXED_OTP: '11111' });
    expect(service.generateCode()).toMatch(/^\d{5}$/);
    expect(service.generateCode()).not.toBe('11111');
    process.env.NODE_ENV = original;
  });

  it('hash() is deterministic for the same phone+code+pepper', () => {
    const service = makeService();
    expect(service.hash('+989123456789', '12345')).toBe(
      service.hash('+989123456789', '12345'),
    );
  });

  it('hash() differs across phones, codes, or peppers', () => {
    const service = makeService();
    const base = service.hash('+989123456789', '12345');
    expect(service.hash('+989123456780', '12345')).not.toBe(base);
    expect(service.hash('+989123456789', '54321')).not.toBe(base);
    expect(
      makeService({ OTP_PEPPER: 'other-pepper' }).hash(
        '+989123456789',
        '12345',
      ),
    ).not.toBe(base);
  });

  it('verify() returns true for the matching code against its hash', () => {
    const service = makeService();
    const hash = service.hash('+989123456789', '12345');
    expect(service.verify('+989123456789', '12345', hash)).toBe(true);
  });

  it('verify() returns false for a wrong code against a real hash', () => {
    const service = makeService();
    const hash = service.hash('+989123456789', '12345');
    expect(service.verify('+989123456789', '99999', hash)).toBe(false);
  });

  it('verify() returns false (never throws) when storedHash is null, still computing a dummy HMAC', () => {
    const service = makeService();
    expect(service.verify('+989123456789', '12345', null)).toBe(false);
  });

  it('verify() takes a comparable amount of time whether storedHash is null or a real mismatch', () => {
    // Not a precise timing assertion (too flaky in CI) — just proves both
    // paths actually execute a timingSafeEqual comparison by sampling a
    // few runs and checking neither path is orders of magnitude faster,
    // which would indicate an early return.
    const service = makeService();
    const hash = service.hash('+989123456789', '12345');

    const withHash = () => service.verify('+989123456789', '99999', hash);
    const withoutHash = () => service.verify('+989123456789', '99999', null);

    const time = (fn: () => void): number => {
      const start = process.hrtime.bigint();
      for (let i = 0; i < 500; i++) fn();
      return Number(process.hrtime.bigint() - start);
    };

    const t1 = time(withHash);
    const t2 = time(withoutHash);
    const ratio = Math.max(t1, t2) / Math.min(t1, t2);
    expect(ratio).toBeLessThan(10);
  });
});
