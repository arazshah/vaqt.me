import { randomUUID } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { prisma } from '@vaqt/db';
import { ErrorCode } from '../../common/errors/error-codes';
import { KvService } from '../../common/kv/kv.service';
import { fakeConfig } from '../../test-support/fake-config';
import { AuditService } from '../audit/audit.service';
import { AuthConfigService } from '../auth.config';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { SessionService } from '../session/session.service';
import { TokenService } from '../session/token.service';
import { AntiSpamService } from './anti-spam.service';
import { PasswordAuthService } from './password-auth.service';
import { PasswordService } from './password.service';

// scrypt is deliberately slow; give it headroom when the whole suite runs in parallel
jest.setTimeout(30_000);

const RUN = randomUUID().slice(0, 8);
const config = fakeConfig({
  OTP_PEPPER: 'test-pepper',
  JWT_ACCESS_SECRET: 'access-secret',
  JWT_REFRESH_SECRET: 'refresh-secret',
});
const authConfig = new AuthConfigService(config);
const audit = new AuditService();
const antiSpam = new AntiSpamService(config);
const passwords = new PasswordService();
const service = new PasswordAuthService(
  passwords,
  antiSpam,
  new RateLimitService(new KvService(), authConfig),
  new SessionService(
    new TokenService(new JwtService(), config, authConfig),
    authConfig,
    audit,
  ),
  audit,
  authConfig,
);

const emails: string[] = [];
function newEmail(): string {
  const e = `u${randomUUID().slice(0, 8)}@qa.vaqt.test`;
  emails.push(e);
  return e;
}
const device = (label: string) => ({
  userAgent: 'jest',
  ip: `${RUN}-${label}-${randomUUID().slice(0, 4)}`,
});
// A form opened long enough ago to pass the "not instant" check.
const oldToken = () => antiSpam.issueFormToken(Date.now() - 10_000);

afterAll(async () => {
  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true },
  });
  const ids = users.map((u) => u.id);
  await prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } });
  await prisma.session.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
});

describe('PasswordService', () => {
  it('verifies the right password and rejects others; never stores plaintext', async () => {
    const hash = await passwords.hash('Sup3rSecret!');
    expect(hash).not.toContain('Sup3rSecret');
    expect(await passwords.verify('Sup3rSecret!', hash)).toBe(true);
    expect(await passwords.verify('wrong-pass1', hash)).toBe(false);
  });

  it('treats an unknown account (null hash) as a failure', async () => {
    expect(await passwords.verify('anything1', null)).toBe(false);
  });
});

describe('AntiSpamService', () => {
  it('rejects a filled honeypot, a forged token, an instant and a stale submit', () => {
    const ok = oldToken();
    expect(() => {
      antiSpam.assertHuman({ formToken: ok });
    }).not.toThrow();
    expect(() => {
      antiSpam.assertHuman({ formToken: ok, website: 'http://spam' });
    }).toThrow();
    expect(() => {
      antiSpam.assertHuman({ formToken: `${ok}x` });
    }).toThrow();
    expect(() => {
      antiSpam.assertHuman({ formToken: antiSpam.issueFormToken() });
    }).toThrow();
    expect(() => {
      antiSpam.assertHuman({
        formToken: antiSpam.issueFormToken(Date.now() - 3 * 3600_000),
      });
    }).toThrow();
  });

  it('blocks throwaway email domains', () => {
    expect(() => {
      antiSpam.assertEmailAllowed('a@mailinator.com');
    }).toThrow();
    expect(() => {
      antiSpam.assertEmailAllowed('a@gmail.com');
    }).not.toThrow();
  });
});

describe('PasswordAuthService (real Postgres)', () => {
  it('registers, then logs in with the same credentials', async () => {
    const email = newEmail();
    const reg = await service.register(
      { email, password: 'Passw0rdOK', formToken: oldToken() },
      device('reg'),
    );
    expect(reg.user.email).toBe(email);
    expect(reg.user.passwordHash).toBeTruthy();
    expect(reg.user.passwordHash).not.toContain('Passw0rdOK');
    expect(reg.tokens.accessToken).toBeTruthy();

    const login = await service.login(
      { email, password: 'Passw0rdOK' },
      device('login'),
    );
    expect(login.user.id).toBe(reg.user.id);
  });

  it('answers a wrong password and an unknown email identically', async () => {
    const email = newEmail();
    await service.register(
      { email, password: 'Passw0rdOK', formToken: oldToken() },
      device('reg2'),
    );
    const [wrong, unknown] = await Promise.allSettled([
      service.login({ email, password: 'nope-nope1' }, device('a')),
      service.login({ email: newEmail(), password: 'nope-nope1' }, device('b')),
    ]);
    for (const r of [wrong, unknown]) {
      expect(r.status).toBe('rejected');
      expect((r as PromiseRejectedResult).reason).toMatchObject({
        response: { code: ErrorCode.INVALID_CREDENTIALS },
      });
    }
  });

  it('refuses a second account with the same email', async () => {
    const email = newEmail();
    await service.register(
      { email, password: 'Passw0rdOK', formToken: oldToken() },
      device('r3'),
    );
    await expect(
      service.register(
        { email, password: 'Passw0rdOK', formToken: oldToken() },
        device('r4'),
      ),
    ).rejects.toMatchObject({ response: { code: ErrorCode.EMAIL_TAKEN } });
  });

  it('caps sign-ups per IP', async () => {
    const dev = device('flood');
    for (let i = 0; i < 5; i++) {
      await service.register(
        { email: newEmail(), password: 'Passw0rdOK', formToken: oldToken() },
        dev,
      );
    }
    await expect(
      service.register(
        { email: newEmail(), password: 'Passw0rdOK', formToken: oldToken() },
        dev,
      ),
    ).rejects.toMatchObject({
      response: { code: ErrorCode.TOO_MANY_ATTEMPTS },
    });
  });

  it('locks password guessing for one email after repeated failures', async () => {
    const email = newEmail();
    await service.register(
      { email, password: 'Passw0rdOK', formToken: oldToken() },
      device('r5'),
    );
    let last: unknown;
    for (let i = 0; i < 11; i++) {
      last = await service
        .login({ email, password: 'bad-pass-1' }, device(`g${String(i)}`))
        .catch((e: unknown) => e);
    }
    expect(last).toMatchObject({
      response: { code: ErrorCode.TOO_MANY_ATTEMPTS },
    });
    // even the right password is refused while locked
    await expect(
      service.login({ email, password: 'Passw0rdOK' }, device('g-ok')),
    ).rejects.toMatchObject({
      response: { code: ErrorCode.TOO_MANY_ATTEMPTS },
    });
  });
});
