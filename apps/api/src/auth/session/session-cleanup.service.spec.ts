import { prisma } from '@vaqt/db';
import { cleanupTestUser, createTestUser } from '../../test-support/test-db';
import { SessionCleanupService } from './session-cleanup.service';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('SessionCleanupService', () => {
  const createdUserIds: string[] = [];
  const service = new SessionCleanupService();

  afterAll(async () => {
    for (const id of createdUserIds.splice(0)) {
      await cleanupTestUser(id);
    }
    await prisma.$disconnect();
  });

  async function makeUser(): Promise<string> {
    const user = await createTestUser({});
    createdUserIds.push(user.id);
    return user.id;
  }

  async function makeSession(
    userId: string,
    overrides: { revokedAt?: Date | null; expiresAt: Date },
  ): Promise<string> {
    const session = await prisma.session.create({
      data: {
        userId,
        familyId: `family-${userId}`,
        refreshTokenHash: `hash-${Math.random().toString(36).slice(2)}`,
        expiresAt: overrides.expiresAt,
        revokedAt: overrides.revokedAt ?? null,
      },
    });
    return session.id;
  }

  it('deletes a session revoked more than 90 days ago', async () => {
    const userId = await makeUser();
    const oldRevoked = await makeSession(userId, {
      revokedAt: new Date(Date.now() - 100 * DAY_MS),
      expiresAt: new Date(Date.now() - 95 * DAY_MS),
    });

    const now = new Date();
    const deletedCount = await service.cleanupOldSessions(now);

    expect(deletedCount).toBeGreaterThanOrEqual(1);
    await expect(
      prisma.session.findUnique({ where: { id: oldRevoked } }),
    ).resolves.toBeNull();
  });

  it('keeps a session revoked only 10 days ago', async () => {
    const userId = await makeUser();
    const recentlyRevoked = await makeSession(userId, {
      revokedAt: new Date(Date.now() - 10 * DAY_MS),
      expiresAt: new Date(Date.now() + 20 * DAY_MS),
    });

    await service.cleanupOldSessions(new Date());

    await expect(
      prisma.session.findUnique({ where: { id: recentlyRevoked } }),
    ).resolves.not.toBeNull();

    await prisma.session.delete({ where: { id: recentlyRevoked } });
  });

  it('deletes a never-revoked session whose expiresAt is more than 90 days in the past', async () => {
    const userId = await makeUser();
    const longExpired = await makeSession(userId, {
      revokedAt: null,
      expiresAt: new Date(Date.now() - 91 * DAY_MS),
    });

    await service.cleanupOldSessions(new Date());

    await expect(
      prisma.session.findUnique({ where: { id: longExpired } }),
    ).resolves.toBeNull();
  });

  it('keeps an active (not revoked, not expired) session', async () => {
    const userId = await makeUser();
    const active = await makeSession(userId, {
      revokedAt: null,
      expiresAt: new Date(Date.now() + 30 * DAY_MS),
    });

    await service.cleanupOldSessions(new Date());

    await expect(
      prisma.session.findUnique({ where: { id: active } }),
    ).resolves.not.toBeNull();

    await prisma.session.delete({ where: { id: active } });
  });

  it('keeps a recently-expired-but-not-revoked session (under the 90-day cutoff)', async () => {
    const userId = await makeUser();
    const recentlyExpired = await makeSession(userId, {
      revokedAt: null,
      expiresAt: new Date(Date.now() - 5 * DAY_MS),
    });

    await service.cleanupOldSessions(new Date());

    await expect(
      prisma.session.findUnique({ where: { id: recentlyExpired } }),
    ).resolves.not.toBeNull();

    await prisma.session.delete({ where: { id: recentlyExpired } });
  });

  it('defaults to the current time when no `now` argument is given', async () => {
    const userId = await makeUser();
    const oldRevoked = await makeSession(userId, {
      revokedAt: new Date(Date.now() - 100 * DAY_MS),
      expiresAt: new Date(Date.now() - 95 * DAY_MS),
    });

    await service.cleanupOldSessions();

    await expect(
      prisma.session.findUnique({ where: { id: oldRevoked } }),
    ).resolves.toBeNull();
  });

  it('returns the exact count of rows it deleted', async () => {
    const userId = await makeUser();
    await makeSession(userId, {
      revokedAt: new Date(Date.now() - 200 * DAY_MS),
      expiresAt: new Date(Date.now() - 195 * DAY_MS),
    });
    await makeSession(userId, {
      revokedAt: new Date(Date.now() - 150 * DAY_MS),
      expiresAt: new Date(Date.now() - 145 * DAY_MS),
    });
    await makeSession(userId, {
      revokedAt: null,
      expiresAt: new Date(Date.now() + 1 * DAY_MS),
    });

    const deletedCount = await service.cleanupOldSessions(new Date());
    expect(deletedCount).toBe(2);
  });
});
