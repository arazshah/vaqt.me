import { randomUUID } from 'node:crypto';
import { prisma } from '@vaqt/db';
import { AuditService } from '../auth/audit/audit.service';
import type { SessionService } from '../auth/session/session.service';
import { ErrorCode } from '../common/errors/error-codes';
import { KvService } from '../common/kv/kv.service';
import { fakeConfig } from '../test-support/fake-config';
import { AdminSetupService } from './admin-setup.service';

const DEVICE = { userAgent: 'jest', ip: randomUUID() };

function phone(): string {
  return `+9899${String(Date.now()).slice(-4)}${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`;
}
const local = (p: string) => `0${p.slice(3)}`;

// The "no admin exists yet" precondition is global state, and roles.guard.spec
// creates real ADMIN users, so wait for any such leftovers to go away first.
async function waitForNoAdmin(): Promise<void> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if ((await prisma.user.count({ where: { systemRole: 'ADMIN' } })) === 0)
      return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('another suite left an ADMIN user behind');
}

describe('AdminSetupService (real Postgres + Redis)', () => {
  const created: string[] = [];
  let redis: KvService;
  let service: AdminSetupService;
  const sessions = {
    createSession: jest
      .fn()
      .mockResolvedValue({ accessToken: 'a', refreshToken: 'r' }),
  } as unknown as SessionService;

  beforeEach(async () => {
    await waitForNoAdmin();
    redis = new KvService();
    service = new AdminSetupService(
      redis,
      new AuditService(),
      fakeConfig({ WEB_ORIGIN: 'https://vaqt.me' }),
    );
    jest.clearAllMocks();
  });
  afterEach(async () => {
    // Do not leave an admin around for the next test or other suites.
    await prisma.user.updateMany({
      where: { id: { in: created } },
      data: { systemRole: 'USER' },
    });
  });
  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { actorId: { in: created } } });
    await prisma.session.deleteMany({ where: { userId: { in: created } } });
    await prisma.user.deleteMany({ where: { id: { in: created } } });
    await prisma.$disconnect();
  });

  it('makes the phone the first admin when the one-time token matches, and logs them in', async () => {
    const token = service.issueToken();
    expect(await service.needsSetup()).toBe(true);
    const p = phone();
    const { userId } = await service.claim(
      { token, phone: local(p), displayName: 'علی' },
      DEVICE,
      sessions,
    );
    created.push(userId);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user).toMatchObject({
      phone: p,
      systemRole: 'ADMIN',
      displayName: 'علی',
    });
    expect(user.phoneVerifiedAt).not.toBeNull();
    expect(sessions.createSession).toHaveBeenCalledWith(userId, DEVICE);
    const audit = await prisma.auditLog.findFirst({
      where: { actorId: userId, action: 'admin.setup.claimed' },
    });
    expect(JSON.stringify(audit?.meta)).not.toContain(p.slice(3)); // phone is masked in the log
  });

  it('promotes an already-registered user instead of creating a duplicate', async () => {
    const p = phone();
    const existing = await prisma.user.create({
      data: { phone: p, displayName: 'کاربر قدیمی' },
    });
    created.push(existing.id);
    const { userId } = await service.claim(
      { token: service.issueToken(), phone: p },
      DEVICE,
      sessions,
    );
    expect(userId).toBe(existing.id);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: userId } }))
        .systemRole,
    ).toBe('ADMIN');
  });

  it('rejects a wrong token and creates nothing; also when no token was ever issued', async () => {
    service.issueToken();
    const p = phone();
    await expect(
      service.claim({ token: 'x'.repeat(30), phone: p }, DEVICE, sessions),
    ).rejects.toMatchObject({
      response: { code: ErrorCode.SETUP_TOKEN_INVALID },
    });
    expect(await prisma.user.count({ where: { phone: p } })).toBe(0);
    expect(sessions.createSession).not.toHaveBeenCalled();

    const fresh = new AdminSetupService(
      redis,
      new AuditService(),
      fakeConfig({}),
    );
    await expect(
      fresh.claim({ token: 'x'.repeat(30), phone: p }, DEVICE, sessions),
    ).rejects.toMatchObject({
      response: { code: ErrorCode.SETUP_TOKEN_INVALID },
    });
  });

  it('rejects an invalid phone number', async () => {
    await expect(
      service.claim(
        { token: service.issueToken(), phone: '12345678901' },
        DEVICE,
        sessions,
      ),
    ).rejects.toMatchObject({ response: { code: ErrorCode.VALIDATION_ERROR } });
  });

  it('is single-use: the token dies after one success, and the endpoint disappears once an admin exists', async () => {
    const token = service.issueToken();
    const first = await service.claim(
      { token, phone: phone() },
      DEVICE,
      sessions,
    );
    created.push(first.userId);
    expect(await service.needsSetup()).toBe(false);
    await expect(
      service.claim({ token, phone: phone() }, DEVICE, sessions),
    ).rejects.toMatchObject({ response: { code: ErrorCode.NOT_FOUND } });
  });

  it('lets only one of several simultaneous claims win', async () => {
    const token = service.issueToken();
    const phones = [phone(), phone(), phone(), phone()];
    const results = await Promise.allSettled(
      phones.map((p) => service.claim({ token, phone: p }, DEVICE, sessions)),
    );
    for (const r of results)
      if (r.status === 'fulfilled') created.push(r.value.userId);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(
      await prisma.user.count({
        where: { phone: { in: phones }, systemRole: 'ADMIN' },
      }),
    ).toBe(1);
  });

  it('throttles guessing from one address', async () => {
    service.issueToken();
    let last: unknown;
    for (let i = 0; i < 11; i++) {
      last = await service
        .claim({ token: 'y'.repeat(30), phone: phone() }, DEVICE, sessions)
        .catch((e: unknown) => e);
    }
    expect(last).toMatchObject({
      response: { code: ErrorCode.TOO_MANY_ATTEMPTS },
    });
  });
});
