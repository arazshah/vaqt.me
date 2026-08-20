import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { prisma, SystemRole, UserStatus } from '@vaqt/db';
import { AppError } from '../errors/app-error';
import { RedisService } from '../redis/redis.service';
import { fakeConfig } from '../../test-support/fake-config';
import {
  cleanupTestUser,
  createTestUser,
  randomTestRedisPrefix,
} from '../../test-support/test-db';
import { AuthConfigService } from '../../auth/auth.config';
import type { AuthenticatedRequest } from '../../auth/auth-request';
import { RolesGuard } from './roles.guard';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6380';

function makeContext(userId: string | undefined): ExecutionContext {
  const request: Partial<AuthenticatedRequest> = userId
    ? { user: { sub: userId, sid: 'session-id' } }
    : {};
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const createdUserIds: string[] = [];
  let redis: RedisService;
  let reflector: Reflector;
  let guard: RolesGuard;

  beforeEach(() => {
    const config = fakeConfig({
      REDIS_URL,
      REDIS_PREFIX: randomTestRedisPrefix(),
      VERIFIED_PHONE_CACHE_TTL_SECONDS: '30',
    });
    redis = new RedisService(config);
    reflector = new Reflector();
    guard = new RolesGuard(reflector, redis, new AuthConfigService(config));
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

  async function makeUser(systemRole: SystemRole): Promise<string> {
    const user = await createTestUser({});
    createdUserIds.push(user.id);
    await prisma.user.update({ where: { id: user.id }, data: { systemRole } });
    return user.id;
  }

  it('allows the request through when no @Roles() metadata is present', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    await expect(guard.canActivate(makeContext('irrelevant'))).resolves.toBe(
      true,
    );
  });

  it('allows the request through when @Roles() is called with an empty list', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([]);
    await expect(guard.canActivate(makeContext('irrelevant'))).resolves.toBe(
      true,
    );
  });

  it('throws UNAUTHORIZED when there is no authenticated user', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([SystemRole.ADMIN]);
    await expect(guard.canActivate(makeContext(undefined))).rejects.toThrow(
      AppError,
    );
  });

  it('allows an ADMIN user through a route requiring ADMIN', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([SystemRole.ADMIN]);
    const userId = await makeUser(SystemRole.ADMIN);
    await expect(guard.canActivate(makeContext(userId))).resolves.toBe(true);
  });

  it('rejects a USER (non-ADMIN) on a route requiring ADMIN', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([SystemRole.ADMIN]);
    const userId = await makeUser(SystemRole.USER);
    await expect(guard.canActivate(makeContext(userId))).rejects.toThrow(
      AppError,
    );
  });

  it('rejects when the user id does not exist in the database', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([SystemRole.ADMIN]);
    await expect(
      guard.canActivate(makeContext('does-not-exist')),
    ).rejects.toThrow(AppError);
  });

  it('rejects a suspended admin (status gate applies regardless of role)', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([SystemRole.ADMIN]);
    const userId = await makeUser(SystemRole.ADMIN);
    await prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.SUSPENDED },
    });
    await redis.client.del(redis.key('system-role', userId));
    await expect(guard.canActivate(makeContext(userId))).rejects.toThrow(
      AppError,
    );
  });

  it('reads from the database — not from the JWT — so a role change in the DB is reflected once the cache is bypassed', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([SystemRole.ADMIN]);
    const userId = await makeUser(SystemRole.USER);

    await expect(guard.canActivate(makeContext(userId))).rejects.toThrow(
      AppError,
    );

    await prisma.user.update({
      where: { id: userId },
      data: { systemRole: SystemRole.ADMIN },
    });
    // Same cache-bypass technique as require-verified-phone.guard.spec.ts:
    // delete this test's own cache key (never the whole Redis DB) to
    // simulate the TTL having expired, since RolesGuard has no explicit
    // invalidation-on-write path — it relies purely on the 30s TTL, same
    // as RequireVerifiedPhoneGuard.
    await redis.client.del(redis.key('system-role', userId));

    await expect(guard.canActivate(makeContext(userId))).resolves.toBe(true);
  });

  it('caches the role in Redis so a second call within the TTL skips the DB read', async () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([SystemRole.ADMIN]);
    const userId = await makeUser(SystemRole.ADMIN);

    await guard.canActivate(makeContext(userId));
    await prisma.user.update({
      where: { id: userId },
      data: { systemRole: SystemRole.USER },
    });

    // Cache not flushed this time — should still read the stale cached
    // ADMIN role and allow, proving the cache is actually consulted.
    await expect(guard.canActivate(makeContext(userId))).resolves.toBe(true);
  });
});
