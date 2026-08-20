import { JwtService } from '@nestjs/jwt';
import { prisma } from '@vaqt/db';
import { AppError } from '../common/errors/app-error';
import { ErrorCode } from '../common/errors/error-codes';
import { RedisService } from '../common/redis/redis.service';
import { fakeConfig } from '../test-support/fake-config';
import {
  cleanupTestUser,
  createTestUser,
  randomTestPhone,
  randomTestRedisPrefix,
  requireNonNull,
} from '../test-support/test-db';
import { AuthConfigService } from './auth.config';
import { AuthService } from './auth.service';
import { AuditService } from './audit/audit.service';
import { OtpService } from './otp/otp.service';
import { OtpPendingCodeStore } from './otp/otp-pending-code.store';
import { RateLimitService } from './rate-limit/rate-limit.service';
import { SessionService } from './session/session.service';
import { TokenService } from './session/token.service';
import type { SmsQueueService } from './sms/sms-queue.service';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6380';
const DEVICE = { userAgent: 'jest-test-agent', ip: '198.51.100.10' };

function makeAuthService(overrides: Record<string, string> = {}): {
  service: AuthService;
  redis: RedisService;
  config: AuthConfigService;
  smsQueue: { enqueueOtp: jest.Mock };
} {
  const config = fakeConfig({
    OTP_PEPPER: 'test-pepper',
    JWT_ACCESS_SECRET: 'access-secret',
    JWT_REFRESH_SECRET: 'refresh-secret',
    REDIS_URL,
    REDIS_PREFIX: randomTestRedisPrefix(),
    RATE_LIMIT_RESEND_COOLDOWN_SECONDS: '60',
    RATE_LIMIT_MAX_RESEND_PER_CODE: '3',
    RATE_LIMIT_MAX_VERIFY_ATTEMPTS: '2',
    RATE_LIMIT_PHONE_HOURLY: '5',
    RATE_LIMIT_PHONE_DAILY: '10',
    RATE_LIMIT_IP_HOURLY: '15',
    RATE_LIMIT_IP_DAILY: '40',
    RATE_LIMIT_INVALIDATED_STREAK_THRESHOLD: '2',
    RATE_LIMIT_BLOCK_SECONDS: '1800',
    ...overrides,
  });
  const authConfig = new AuthConfigService(config);
  const redis = new RedisService(config);
  const otp = new OtpService(config);
  const rateLimit = new RateLimitService(redis, authConfig);
  const pendingCode = new OtpPendingCodeStore(redis);
  const smsQueue = { enqueueOtp: jest.fn().mockResolvedValue(undefined) };
  const tokens = new TokenService(new JwtService(), config, authConfig);
  const audit = new AuditService();
  const sessions = new SessionService(tokens, authConfig, audit);

  const service = new AuthService(
    otp,
    rateLimit,
    pendingCode,
    smsQueue as unknown as SmsQueueService,
    sessions,
    audit,
    authConfig,
    redis,
  );

  return { service, redis, config: authConfig, smsQueue };
}

async function expectAppError(
  promise: Promise<unknown>,
  code: ErrorCode,
): Promise<AppError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(code);
    return error as AppError;
  }
  throw new Error(`expected promise to reject with AppError(${code})`);
}

describe('AuthService', () => {
  const createdUserIds: string[] = [];
  const createdPhones: string[] = [];
  const redisInstances: RedisService[] = [];

  afterEach(async () => {
    for (const redis of redisInstances.splice(0)) {
      await redis.client.quit();
    }
  });

  afterAll(async () => {
    for (const id of createdUserIds.splice(0)) {
      await cleanupTestUser(id);
    }
    for (const phone of createdPhones.splice(0)) {
      await prisma.verificationCode.deleteMany({ where: { phone } });
    }
    await prisma.$disconnect();
  });

  function track(redis: RedisService): void {
    redisInstances.push(redis);
  }

  describe('requestOtp', () => {
    it('returns { ok, expiresIn, resendAfter } and enqueues an SMS job', async () => {
      const { service, redis, smsQueue } = makeAuthService();
      track(redis);
      const phone = randomTestPhone();
      createdPhones.push(phone);

      const result = await service.requestOtp(phone, '198.51.100.1');

      expect(result.ok).toBe(true);
      expect(result.expiresIn).toBeGreaterThan(0);
      expect(result.resendAfter).toBe(60);
      // expect.any(String) is typed `any` by @types/jest — assigning it to
      // an explicitly `unknown`-typed field (rather than letting it infer
      // as `any`) keeps this safe under strict-type-checked eslint rules.
      const expectedJob: { phone: string; code: unknown } = {
        phone,
        code: expect.any(String),
      };
      expect(smsQueue.enqueueOtp).toHaveBeenCalledWith(expectedJob);
    });

    it('response shape is identical whether or not a User already exists for the phone', async () => {
      const { service: serviceA, redis: redisA } = makeAuthService();
      track(redisA);
      const existingUser = await createTestUser({});
      createdUserIds.push(existingUser.id);
      const resultForExisting = await serviceA.requestOtp(
        existingUser.phone,
        '198.51.100.2',
      );

      const { service: serviceB, redis: redisB } = makeAuthService();
      track(redisB);
      const newPhone = randomTestPhone();
      createdPhones.push(newPhone);
      const resultForNew = await serviceB.requestOtp(newPhone, '198.51.100.2');

      expect(Object.keys(resultForExisting).sort()).toEqual(
        Object.keys(resultForNew).sort(),
      );
      expect(resultForExisting.ok).toBe(resultForNew.ok);
      expect(resultForExisting.resendAfter).toBe(resultForNew.resendAfter);
    });

    it('rejects an invalid phone number with PHONE_INVALID', async () => {
      const { service, redis } = makeAuthService();
      track(redis);
      await expectAppError(
        service.requestOtp('not-a-phone', '198.51.100.3'),
        ErrorCode.PHONE_INVALID,
      );
    });

    it('resend cooldown: an immediate second request for the same phone is rate limited', async () => {
      const { service, redis } = makeAuthService();
      track(redis);
      const phone = randomTestPhone();
      createdPhones.push(phone);

      await service.requestOtp(phone, '198.51.100.4');
      const error = await expectAppError(
        service.requestOtp(phone, '198.51.100.4'),
        ErrorCode.OTP_RATE_LIMITED,
      );
      expect(error.retryAfterSeconds).toBeGreaterThan(0);
    });

    it('resend re-sends the same code and does not extend expiresAt', async () => {
      const { service, redis } = makeAuthService();
      track(redis);
      const phone = randomTestPhone();
      createdPhones.push(phone);

      await service.requestOtp(phone, '198.51.100.5');
      const firstRow = await prisma.verificationCode.findFirst({
        where: { phone },
        orderBy: { createdAt: 'desc' },
      });

      // bypass only the resend cooldown (not the whole rate limit stack)
      await redis.client.del(redis.key('ratelimit', 'otp-resend', phone));
      await service.requestOtp(phone, '198.51.100.5');

      const secondRow = await prisma.verificationCode.findFirst({
        where: { phone },
        orderBy: { createdAt: 'desc' },
      });

      expect(secondRow?.id).toBe(firstRow?.id);
      expect(secondRow?.expiresAt.getTime()).toBe(
        firstRow?.expiresAt.getTime(),
      );
      expect(secondRow?.sendCount).toBe(2);
    });

    it('resend still works (issuing a fresh code on the same row) if Redis lost the pending plaintext', async () => {
      const { service, redis } = makeAuthService();
      track(redis);
      const phone = randomTestPhone();
      createdPhones.push(phone);

      await service.requestOtp(phone, '198.51.100.5b');
      const firstRow = await prisma.verificationCode.findFirst({
        where: { phone },
        orderBy: { createdAt: 'desc' },
      });

      // Simulate the pending-code cache entry being gone (e.g. Redis
      // restart) while the VerificationCode row itself is still active.
      await redis.client.del(redis.key('otp', 'pending-code', phone));
      await redis.client.del(redis.key('ratelimit', 'otp-resend', phone));
      await service.requestOtp(phone, '198.51.100.5b');

      const secondRow = await prisma.verificationCode.findFirst({
        where: { phone },
        orderBy: { createdAt: 'desc' },
      });

      expect(secondRow?.id).toBe(firstRow?.id);
      expect(secondRow?.expiresAt.getTime()).toBe(
        firstRow?.expiresAt.getTime(),
      );
      expect(secondRow?.codeHash).not.toBe(firstRow?.codeHash);
      expect(secondRow?.sendCount).toBe(2);

      const newPendingCode = await redis.client.get(
        redis.key('otp', 'pending-code', phone),
      );
      expect(newPendingCode).not.toBeNull();
    });

    it('rejects with OTP_RATE_LIMITED once maxResendPerCode is exceeded', async () => {
      const { service, redis } = makeAuthService({
        RATE_LIMIT_MAX_RESEND_PER_CODE: '2',
      });
      track(redis);
      const phone = randomTestPhone();
      createdPhones.push(phone);

      await service.requestOtp(phone, '198.51.100.6'); // sendCount 1
      await redis.client.del(redis.key('ratelimit', 'otp-resend', phone));
      await service.requestOtp(phone, '198.51.100.6'); // sendCount 2, at the cap
      await redis.client.del(redis.key('ratelimit', 'otp-resend', phone));

      const error = await expectAppError(
        service.requestOtp(phone, '198.51.100.6'),
        ErrorCode.OTP_RATE_LIMITED,
      );
      expect(
        (error.getResponse() as { details?: { reason?: string } }).details
          ?.reason,
      ).toBe('MAX_RESEND_EXCEEDED');
    });

    it('rejects with OTP_RATE_LIMITED once the phone hourly limit is exceeded', async () => {
      const { service, redis } = makeAuthService({
        RATE_LIMIT_PHONE_HOURLY: '1',
        RATE_LIMIT_RESEND_COOLDOWN_SECONDS: '0',
      });
      track(redis);
      const phone = randomTestPhone();
      createdPhones.push(phone);

      await service.requestOtp(phone, '198.51.100.7');
      await expectAppError(
        service.requestOtp(phone, '198.51.100.7'),
        ErrorCode.OTP_RATE_LIMITED,
      );
    });

    it('rejects with OTP_RATE_LIMITED once the phone daily limit is exceeded, under the hourly cap', async () => {
      const { service, redis } = makeAuthService({
        RATE_LIMIT_PHONE_HOURLY: '100',
        RATE_LIMIT_PHONE_DAILY: '1',
        RATE_LIMIT_RESEND_COOLDOWN_SECONDS: '0',
      });
      track(redis);
      const phone = randomTestPhone();
      createdPhones.push(phone);

      await service.requestOtp(phone, '198.51.100.8');
      await expectAppError(
        service.requestOtp(phone, '198.51.100.8'),
        ErrorCode.OTP_RATE_LIMITED,
      );
    });

    it('rejects with OTP_RATE_LIMITED once the IP hourly limit is exceeded, across different phones', async () => {
      const { service, redis } = makeAuthService({
        RATE_LIMIT_IP_HOURLY: '1',
        RATE_LIMIT_RESEND_COOLDOWN_SECONDS: '0',
      });
      track(redis);
      const phoneA = randomTestPhone();
      const phoneB = randomTestPhone();
      createdPhones.push(phoneA, phoneB);
      const ip = '198.51.100.9';

      await service.requestOtp(phoneA, ip);
      await expectAppError(
        service.requestOtp(phoneB, ip),
        ErrorCode.OTP_RATE_LIMITED,
      );
    });

    it('rejects with OTP_RATE_LIMITED once the IP daily limit is exceeded, under the hourly cap', async () => {
      const { service, redis } = makeAuthService({
        RATE_LIMIT_IP_HOURLY: '100',
        RATE_LIMIT_IP_DAILY: '1',
        RATE_LIMIT_RESEND_COOLDOWN_SECONDS: '0',
      });
      track(redis);
      const phoneA = randomTestPhone();
      const phoneB = randomTestPhone();
      createdPhones.push(phoneA, phoneB);
      const ip = '198.51.100.11';

      await service.requestOtp(phoneA, ip);
      await expectAppError(
        service.requestOtp(phoneB, ip),
        ErrorCode.OTP_RATE_LIMITED,
      );
    });

    it('rejects with PHONE_BLOCKED once the invalidated-code streak threshold is reached', async () => {
      const { service, redis } = makeAuthService({
        RATE_LIMIT_MAX_VERIFY_ATTEMPTS: '1',
        RATE_LIMIT_INVALIDATED_STREAK_THRESHOLD: '2',
        RATE_LIMIT_RESEND_COOLDOWN_SECONDS: '0',
      });
      track(redis);
      const phone = randomTestPhone();
      createdPhones.push(phone);

      // First invalidation cycle: one below the streak threshold, so the
      // failed verify itself still reports OTP_INVALID.
      await service.requestOtp(phone, '198.51.100.12');
      await expectAppError(
        service.verifyOtp(phone, '00000', DEVICE),
        ErrorCode.OTP_INVALID,
      );

      // Second invalidation cycle reaches the threshold — the block fires
      // immediately, from the verify call itself, not from a later request.
      await service.requestOtp(phone, '198.51.100.12');
      await expectAppError(
        service.verifyOtp(phone, '00000', DEVICE),
        ErrorCode.PHONE_BLOCKED,
      );

      await expectAppError(
        service.requestOtp(phone, '198.51.100.12'),
        ErrorCode.PHONE_BLOCKED,
      );
    });
  });

  describe('verifyOtp', () => {
    it('rejects OTP_INVALID when there is no active code for the phone (and phone-existence does not leak)', async () => {
      const { service, redis } = makeAuthService();
      track(redis);
      const phone = randomTestPhone();
      createdPhones.push(phone);
      await expectAppError(
        service.verifyOtp(phone, '12345', DEVICE),
        ErrorCode.OTP_INVALID,
      );
    });

    it('rejects OTP_EXPIRED once expiresAt has passed', async () => {
      const { service, redis } = makeAuthService();
      track(redis);
      const phone = randomTestPhone();
      createdPhones.push(phone);

      await service.requestOtp(phone, '198.51.100.13');
      await prisma.verificationCode.updateMany({
        where: { phone, consumedAt: null },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      await expectAppError(
        service.verifyOtp(phone, '00000', DEVICE),
        ErrorCode.OTP_EXPIRED,
      );
    });

    it('rejects a wrong code with OTP_INVALID and reports attemptsRemaining', async () => {
      const { service, redis } = makeAuthService({
        RATE_LIMIT_MAX_VERIFY_ATTEMPTS: '3',
      });
      track(redis);
      const phone = randomTestPhone();
      createdPhones.push(phone);

      await service.requestOtp(phone, '198.51.100.14');
      const error = await expectAppError(
        service.verifyOtp(phone, '00000', DEVICE),
        ErrorCode.OTP_INVALID,
      );
      expect(
        (error.getResponse() as { details?: { attemptsRemaining?: number } })
          .details?.attemptsRemaining,
      ).toBe(2);
    });

    it('invalidates the code after maxVerifyAttempts wrong attempts, even if the right code is tried afterward', async () => {
      const { service, redis } = makeAuthService({
        RATE_LIMIT_MAX_VERIFY_ATTEMPTS: '2',
      });
      track(redis);
      const phone = randomTestPhone();
      createdPhones.push(phone);

      await service.requestOtp(phone, '198.51.100.15');
      await expectAppError(
        service.verifyOtp(phone, '00000', DEVICE),
        ErrorCode.OTP_INVALID,
      );
      await expectAppError(
        service.verifyOtp(phone, '00000', DEVICE),
        ErrorCode.OTP_INVALID,
      );

      const row = await prisma.verificationCode.findFirst({
        where: { phone },
        orderBy: { createdAt: 'desc' },
      });
      expect(row?.consumedAt).not.toBeNull();

      // Invalidation also clears the Redis pending-code entry, so the
      // plaintext is unrecoverable now — any code (including a lucky
      // guess of the real one) must be rejected once the row is consumed.
      await expect(
        redis.client.get(redis.key('otp', 'pending-code', phone)),
      ).resolves.toBeNull();
      await expectAppError(
        service.verifyOtp(phone, '00000', DEVICE),
        ErrorCode.OTP_INVALID,
      );
    });

    it('a correct code succeeds: creates the user, a session, and an audit log entry', async () => {
      const { service, redis } = makeAuthService();
      track(redis);

      const phone = randomTestPhone();
      createdPhones.push(phone);
      await service.requestOtp(phone, '198.51.100.16');

      // Recover the real plaintext code from the pending-code Redis store
      // the same way a resend would — the service never exposes it via
      // Postgres, only via that short-lived cache.
      const code = requireNonNull(
        await redis.client.get(redis.key('otp', 'pending-code', phone)),
        'expected a pending OTP code in redis',
      );
      expect(code).not.toBeNull();

      const result = await service.verifyOtp(phone, code, DEVICE);

      expect(result.user.phoneVerified).toBe(true);
      expect(JSON.stringify(result.user)).not.toContain(phone);
      expect(result.tokens.accessToken).toEqual(expect.any(String));
      expect(result.tokens.refreshToken).toEqual(expect.any(String));
      createdUserIds.push(result.user.id);

      const auditEntry = await prisma.auditLog.findFirst({
        where: { actorId: result.user.id, action: 'auth.login.success' },
      });
      expect(auditEntry).not.toBeNull();
    });

    it('verifying again for an already-verified user preserves the original phoneVerifiedAt', async () => {
      const originalVerifiedAt = new Date(
        Date.now() - 10 * 24 * 60 * 60 * 1000,
      );
      const user = await createTestUser({
        phoneVerifiedAt: originalVerifiedAt,
      });
      createdUserIds.push(user.id);

      const { service, redis } = makeAuthService();
      track(redis);
      await service.requestOtp(user.phone, '198.51.100.17');
      const code = requireNonNull(
        await redis.client.get(redis.key('otp', 'pending-code', user.phone)),
        'expected a pending OTP code in redis',
      );

      await service.verifyOtp(user.phone, code, DEVICE);
      const row = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(row.phoneVerifiedAt?.getTime()).toBe(originalVerifiedAt.getTime());
    });

    it('verifying for a pre-existing but never-verified user sets phoneVerifiedAt to now', async () => {
      const user = await createTestUser({ phoneVerifiedAt: null });
      createdUserIds.push(user.id);

      const { service, redis } = makeAuthService();
      track(redis);
      const before = Date.now();
      await service.requestOtp(user.phone, '198.51.100.17b');
      const code = requireNonNull(
        await redis.client.get(redis.key('otp', 'pending-code', user.phone)),
        'expected a pending OTP code in redis',
      );

      await service.verifyOtp(user.phone, code, DEVICE);
      const row = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(row.phoneVerifiedAt?.getTime()).toBeGreaterThanOrEqual(before);
    });

    it('clears the invalidated-code streak on a successful verification', async () => {
      const { service, redis } = makeAuthService({
        RATE_LIMIT_MAX_VERIFY_ATTEMPTS: '1',
        RATE_LIMIT_INVALIDATED_STREAK_THRESHOLD: '2',
        RATE_LIMIT_RESEND_COOLDOWN_SECONDS: '0',
      });
      track(redis);
      const phone = randomTestPhone();
      createdPhones.push(phone);

      await service.requestOtp(phone, '198.51.100.18');
      await expectAppError(
        service.verifyOtp(phone, '00000', DEVICE),
        ErrorCode.OTP_INVALID,
      );

      await service.requestOtp(phone, '198.51.100.18');
      const code = requireNonNull(
        await redis.client.get(redis.key('otp', 'pending-code', phone)),
        'expected a pending OTP code in redis',
      );
      const result = await service.verifyOtp(phone, code, DEVICE);
      createdUserIds.push(result.user.id);

      // Streak was cleared by the success above, so this single failure
      // afterward should not yet trigger a block.
      await service.requestOtp(phone, '198.51.100.18');
      await expectAppError(
        service.verifyOtp(phone, '00000', DEVICE),
        ErrorCode.OTP_INVALID,
      );
      const stillOk = await service.requestOtp(phone, '198.51.100.18');
      expect(stillOk.ok).toBe(true);
    });
  });

  describe('refresh', () => {
    async function loginFreshUser(
      service: AuthService,
      redis: RedisService,
    ): Promise<{ userId: string; refreshToken: string }> {
      const phone = randomTestPhone();
      createdPhones.push(phone);
      await service.requestOtp(phone, '198.51.100.19');
      const code = requireNonNull(
        await redis.client.get(redis.key('otp', 'pending-code', phone)),
        'expected a pending OTP code in redis',
      );
      const { user, tokens } = await service.verifyOtp(phone, code, DEVICE);
      createdUserIds.push(user.id);
      return { userId: user.id, refreshToken: tokens.refreshToken };
    }

    it('rotates the refresh token and issues a working new pair', async () => {
      const { service, redis } = makeAuthService();
      track(redis);
      const { refreshToken } = await loginFreshUser(service, redis);

      const rotated = await service.refresh(refreshToken, DEVICE);
      expect(rotated.accessToken).toEqual(expect.any(String));
      expect(rotated.refreshToken).not.toBe(refreshToken);
    });

    it('maps refresh-token reuse to AppError(SESSION_REUSE_DETECTED)', async () => {
      const { service, redis } = makeAuthService();
      track(redis);
      const { refreshToken } = await loginFreshUser(service, redis);

      await service.refresh(refreshToken, DEVICE);
      await expectAppError(
        service.refresh(refreshToken, DEVICE),
        ErrorCode.SESSION_REUSE_DETECTED,
      );
    });

    it('maps a garbage refresh token to AppError(SESSION_INVALID)', async () => {
      const { service, redis } = makeAuthService();
      track(redis);
      await expectAppError(
        service.refresh('not-a-real-token', DEVICE),
        ErrorCode.SESSION_INVALID,
      );
    });

    it('rethrows an unrecognized error from session rotation as-is (not wrapped in AppError)', async () => {
      const config = fakeConfig({
        OTP_PEPPER: 'test-pepper',
        REDIS_URL,
        REDIS_PREFIX: randomTestRedisPrefix(),
      });
      const authConfig = new AuthConfigService(config);
      const redis = new RedisService(config);
      track(redis);

      const boom = new Error('unexpected database outage');
      const fakeSessions = { rotateSession: jest.fn().mockRejectedValue(boom) };

      const service = new AuthService(
        new OtpService(config),
        new RateLimitService(redis, authConfig),
        new OtpPendingCodeStore(redis),
        { enqueueOtp: jest.fn() } as never,
        fakeSessions as unknown as SessionService,
        new AuditService(),
        authConfig,
        redis,
      );

      await expect(service.refresh('irrelevant', DEVICE)).rejects.toBe(boom);
    });
  });

  describe('logout / logoutAll', () => {
    it('logout revokes exactly the current session and writes an audit log', async () => {
      const { service, redis } = makeAuthService();
      track(redis);
      const phone = randomTestPhone();
      createdPhones.push(phone);
      await service.requestOtp(phone, '198.51.100.20');
      const code = requireNonNull(
        await redis.client.get(redis.key('otp', 'pending-code', phone)),
        'expected a pending OTP code in redis',
      );
      const { user, tokens } = await service.verifyOtp(phone, code, DEVICE);
      createdUserIds.push(user.id);

      const tokenConfig = fakeConfig({
        JWT_ACCESS_SECRET: 'access-secret',
        JWT_REFRESH_SECRET: 'refresh-secret',
      });
      const tokenService = new TokenService(
        new JwtService(),
        tokenConfig,
        new AuthConfigService(tokenConfig),
      );
      const payload = tokenService.verifyAccessToken(tokens.accessToken);

      await service.logout(user.id, payload.sid);

      const row = await prisma.session.findUnique({
        where: { id: payload.sid },
      });
      expect(row?.revokedAt).not.toBeNull();

      const auditEntry = await prisma.auditLog.findFirst({
        where: { actorId: user.id, action: 'auth.logout' },
      });
      expect(auditEntry).not.toBeNull();
    });

    it('logoutAll revokes every session for the user and writes an audit log', async () => {
      const { service, redis } = makeAuthService();
      track(redis);
      const phone = randomTestPhone();
      createdPhones.push(phone);
      await service.requestOtp(phone, '198.51.100.21');
      const code = requireNonNull(
        await redis.client.get(redis.key('otp', 'pending-code', phone)),
        'expected a pending OTP code in redis',
      );
      const { user } = await service.verifyOtp(phone, code, DEVICE);
      createdUserIds.push(user.id);

      await service.logoutAll(user.id);

      const rows = await prisma.session.findMany({
        where: { userId: user.id },
      });
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((row) => row.revokedAt !== null)).toBe(true);

      const auditEntry = await prisma.auditLog.findFirst({
        where: { actorId: user.id, action: 'auth.logout_all' },
      });
      expect(auditEntry).not.toBeNull();
    });
  });

  describe('getMe / updateRole / createWsTicket', () => {
    it('getMe returns the public user shape', async () => {
      const { service, redis } = makeAuthService();
      track(redis);
      const user = await createTestUser({});
      createdUserIds.push(user.id);

      const result = await service.getMe(user.id);
      expect(result.id).toBe(user.id);
      expect(JSON.stringify(result)).not.toContain(user.phone);
    });

    it('getMe throws UNAUTHORIZED for a user id that no longer exists', async () => {
      const { service, redis } = makeAuthService();
      track(redis);
      await expectAppError(
        service.getMe('does-not-exist'),
        ErrorCode.UNAUTHORIZED,
      );
    });

    it('updateRole persists and returns the new roleIntent', async () => {
      const { service, redis } = makeAuthService();
      track(redis);
      const user = await createTestUser({});
      createdUserIds.push(user.id);

      const result = await service.updateRole(user.id, 'PROVIDER');
      expect(result.roleIntent).toBe('PROVIDER');

      const row = await prisma.user.findUnique({ where: { id: user.id } });
      expect(row?.roleIntent).toBe('PROVIDER');
    });

    it('createWsTicket stores a redis entry mapping the ticket to the user with the configured TTL', async () => {
      const { service, redis } = makeAuthService({
        WS_TICKET_TTL_SECONDS: '60',
      });
      track(redis);
      const user = await createTestUser({});
      createdUserIds.push(user.id);

      const { ticket, expiresIn } = await service.createWsTicket(user.id);
      expect(expiresIn).toBe(60);

      const stored = await redis.client.get(redis.key('ws-ticket', ticket));
      expect(stored).toBe(user.id);

      const ttl = await redis.client.ttl(redis.key('ws-ticket', ticket));
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(60);
    });
  });
});
