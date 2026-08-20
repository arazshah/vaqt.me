import type { ExecutionContext } from '@nestjs/common';
import { prisma, UserStatus } from '@vaqt/db';
import { RedisService } from '../../common/redis/redis.service';
import { AppError } from '../../common/errors/app-error';
import { fakeConfig } from '../../test-support/fake-config';
import {
  cleanupTestUser,
  createTestUser,
  randomTestRedisPrefix,
} from '../../test-support/test-db';
import { AuthConfigService } from '../auth.config';
import type { AuthenticatedRequest } from '../auth-request';
import { RequireVerifiedPhoneGuard } from './require-verified-phone.guard';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6380';

function makeContext(userId: string | undefined): ExecutionContext {
  const request: Partial<AuthenticatedRequest> = userId
    ? { user: { sub: userId, sid: 'session-id' } }
    : {};
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('RequireVerifiedPhoneGuard', () => {
  const createdUserIds: string[] = [];
  let redis: RedisService;
  let guard: RequireVerifiedPhoneGuard;

  beforeEach(() => {
    const config = fakeConfig({
      REDIS_URL,
      REDIS_PREFIX: randomTestRedisPrefix(),
      VERIFIED_PHONE_CACHE_TTL_SECONDS: '30',
    });
    redis = new RedisService(config);
    guard = new RequireVerifiedPhoneGuard(redis, new AuthConfigService(config));
  });

  afterEach(async () => {
    await redis.client.quit();
  });

  afterAll(async () => {
    for (const id of createdUserIds.splice(0)) {
      await cleanupTestUser(id);
    }
    await prisma.$disconnect();
  });

  async function makeUser(phoneVerifiedAt: Date | null): Promise<string> {
    const user = await createTestUser({ phoneVerifiedAt });
    createdUserIds.push(user.id);
    return user.id;
  }

  it('throws UNAUTHORIZED when there is no authenticated user on the request', async () => {
    await expect(guard.canActivate(makeContext(undefined))).rejects.toThrow(
      AppError,
    );
  });

  it('allows a user with phoneVerifiedAt set', async () => {
    const userId = await makeUser(new Date());
    await expect(guard.canActivate(makeContext(userId))).resolves.toBe(true);
  });

  it('rejects a user with phoneVerifiedAt null', async () => {
    const userId = await makeUser(null);
    await expect(guard.canActivate(makeContext(userId))).rejects.toThrow(
      AppError,
    );
  });

  it('rejects when the user id does not exist in the database', async () => {
    await expect(
      guard.canActivate(makeContext('does-not-exist')),
    ).rejects.toThrow(AppError);
  });

  it('reads from the database — not from the JWT — so revoking verification in the DB is reflected on the next (uncached) check', async () => {
    const userId = await makeUser(new Date());

    await expect(guard.canActivate(makeContext(userId))).resolves.toBe(true);

    await prisma.user.update({
      where: { id: userId },
      data: { phoneVerifiedAt: null },
    });
    // Bypass the 30s Redis cache exactly as a fresh guard instance (or a
    // cache expiry) would, to isolate "does it re-read the DB" from
    // "how long does the cache take to expire" — the point under test is
    // that the source of truth is the DB row, not the (unrevocable) JWT.
    // Deletes only this test's own cache key, never the whole Redis DB,
    // since other spec files may be exercising real Redis concurrently.
    await redis.client.del(redis.key('verified-phone', userId));

    await expect(guard.canActivate(makeContext(userId))).rejects.toThrow(
      AppError,
    );
  });

  it('caches the verified result in Redis so a second call within the TTL skips the DB read', async () => {
    const userId = await makeUser(new Date());

    await guard.canActivate(makeContext(userId));
    await prisma.user.update({
      where: { id: userId },
      data: { phoneVerifiedAt: null },
    });

    // Cache not flushed this time — should still read the stale cached
    // "verified: true" and allow, proving the cache is actually consulted.
    await expect(guard.canActivate(makeContext(userId))).resolves.toBe(true);
  });

  it('rejects a suspended user even with phoneVerifiedAt set', async () => {
    const user = await createTestUser({ phoneVerifiedAt: new Date() });
    createdUserIds.push(user.id);
    await prisma.user.update({
      where: { id: user.id },
      data: { status: UserStatus.SUSPENDED },
    });

    await expect(guard.canActivate(makeContext(user.id))).rejects.toThrow(
      AppError,
    );
  });
});
