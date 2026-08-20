import { RedisService } from '../../common/redis/redis.service';
import { fakeConfig } from '../../test-support/fake-config';
import { randomTestRedisPrefix } from '../../test-support/test-db';
import { AuthConfigService } from '../auth.config';
import { RateLimitService } from './rate-limit.service';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6380';

function makeService(overrides: Record<string, string> = {}): {
  service: RateLimitService;
  redis: RedisService;
} {
  const config = fakeConfig({
    REDIS_URL,
    REDIS_PREFIX: randomTestRedisPrefix(),
    ...overrides,
  });
  const redis = new RedisService(config);
  const authConfig = new AuthConfigService(config);
  return { service: new RateLimitService(redis, authConfig), redis };
}

describe('RateLimitService', () => {
  const instances: RedisService[] = [];

  afterEach(async () => {
    for (const redis of instances.splice(0)) {
      await redis.client.quit();
    }
  });

  describe('checkSlidingWindow', () => {
    it('allows requests up to the limit within the window', async () => {
      const { service, redis } = makeService();
      instances.push(redis);
      const now = Date.now();

      const first = await service.checkSlidingWindow(
        'scope',
        'id-1',
        2,
        60,
        now,
      );
      const second = await service.checkSlidingWindow(
        'scope',
        'id-1',
        2,
        60,
        now + 1,
      );

      expect(first.allowed).toBe(true);
      expect(second.allowed).toBe(true);
    });

    it('denies the request once the limit is exceeded, with a positive retryAfterSeconds', async () => {
      const { service, redis } = makeService();
      instances.push(redis);
      const now = Date.now();

      await service.checkSlidingWindow('scope', 'id-2', 1, 60, now);
      const second = await service.checkSlidingWindow(
        'scope',
        'id-2',
        1,
        60,
        now + 1,
      );

      expect(second.allowed).toBe(false);
      expect(second.retryAfterSeconds).toBeGreaterThan(0);
    });

    it('a rejected attempt still occupies a slot (hammering does not reset the window)', async () => {
      const { service, redis } = makeService();
      instances.push(redis);
      const now = Date.now();

      await service.checkSlidingWindow('scope', 'id-3', 1, 60, now);
      await service.checkSlidingWindow('scope', 'id-3', 1, 60, now + 1);
      const third = await service.checkSlidingWindow(
        'scope',
        'id-3',
        1,
        60,
        now + 2,
      );

      expect(third.allowed).toBe(false);
    });

    it('allows again once the window has fully elapsed', async () => {
      const { service, redis } = makeService();
      instances.push(redis);
      const now = Date.now();

      await service.checkSlidingWindow('scope', 'id-4', 1, 1, now);
      const later = await service.checkSlidingWindow(
        'scope',
        'id-4',
        1,
        1,
        now + 2000,
      );

      expect(later.allowed).toBe(true);
    });

    it('different identifiers under the same scope do not interfere', async () => {
      const { service, redis } = makeService();
      instances.push(redis);
      const now = Date.now();

      await service.checkSlidingWindow('scope', 'id-5a', 1, 60, now);
      const other = await service.checkSlidingWindow(
        'scope',
        'id-5b',
        1,
        60,
        now,
      );

      expect(other.allowed).toBe(true);
    });

    it('falls back to `now` for retryAfterSeconds if the zrange lookup races an empty result', async () => {
      // Defensive fallback for the theoretical race where the sorted set
      // is observed empty between the zcard count and the zrange lookup
      // (e.g. a concurrent expiry) — forced deterministically here since
      // it can't be reproduced by timing alone.
      const { service, redis } = makeService();
      instances.push(redis);
      const now = Date.now();

      await service.checkSlidingWindow('scope', 'id-6', 1, 60, now);
      jest.spyOn(redis.client, 'zrange').mockResolvedValueOnce([]);
      const result = await service.checkSlidingWindow(
        'scope',
        'id-6',
        1,
        60,
        now + 1,
      );

      expect(result.allowed).toBe(false);
      expect(result.retryAfterSeconds).toBeGreaterThan(0);
    });
  });

  describe('checkResendCooldown', () => {
    it('allows the first request then denies an immediate second one', async () => {
      const { service, redis } = makeService({
        RATE_LIMIT_RESEND_COOLDOWN_SECONDS: '60',
      });
      instances.push(redis);
      const now = Date.now();

      const first = await service.checkResendCooldown('+989120000001', now);
      const second = await service.checkResendCooldown(
        '+989120000001',
        now + 1,
      );

      expect(first.allowed).toBe(true);
      expect(second.allowed).toBe(false);
      expect(second.retryAfterSeconds).toBeGreaterThan(0);
    });
  });

  describe('checkPhoneRequestLimits', () => {
    it('allows requests under both the hourly and daily phone limits', async () => {
      const { service, redis } = makeService({
        RATE_LIMIT_PHONE_HOURLY: '5',
        RATE_LIMIT_PHONE_DAILY: '10',
      });
      instances.push(redis);
      const result = await service.checkPhoneRequestLimits('+989120000002');
      expect(result.allowed).toBe(true);
    });

    it('denies once the hourly phone limit is exceeded', async () => {
      const { service, redis } = makeService({
        RATE_LIMIT_PHONE_HOURLY: '1',
        RATE_LIMIT_PHONE_DAILY: '10',
      });
      instances.push(redis);
      const now = Date.now();
      await service.checkPhoneRequestLimits('+989120000003', now);
      const second = await service.checkPhoneRequestLimits(
        '+989120000003',
        now + 1,
      );
      expect(second.allowed).toBe(false);
    });

    it('denies once the daily phone limit is exceeded, even under the hourly cap', async () => {
      const { service, redis } = makeService({
        RATE_LIMIT_PHONE_HOURLY: '100',
        RATE_LIMIT_PHONE_DAILY: '1',
      });
      instances.push(redis);
      const now = Date.now();
      await service.checkPhoneRequestLimits('+989120000004', now);
      const second = await service.checkPhoneRequestLimits(
        '+989120000004',
        now + 1,
      );
      expect(second.allowed).toBe(false);
    });
  });

  describe('checkIpRequestLimits', () => {
    it('allows requests under both the hourly and daily IP limits', async () => {
      const { service, redis } = makeService({
        RATE_LIMIT_IP_HOURLY: '5',
        RATE_LIMIT_IP_DAILY: '10',
      });
      instances.push(redis);
      const result = await service.checkIpRequestLimits('203.0.113.1');
      expect(result.allowed).toBe(true);
    });

    it('denies once the hourly IP limit is exceeded', async () => {
      const { service, redis } = makeService({
        RATE_LIMIT_IP_HOURLY: '1',
        RATE_LIMIT_IP_DAILY: '10',
      });
      instances.push(redis);
      const now = Date.now();
      await service.checkIpRequestLimits('203.0.113.2', now);
      const second = await service.checkIpRequestLimits('203.0.113.2', now + 1);
      expect(second.allowed).toBe(false);
    });

    it('denies once the daily IP limit is exceeded, even under the hourly cap', async () => {
      const { service, redis } = makeService({
        RATE_LIMIT_IP_HOURLY: '100',
        RATE_LIMIT_IP_DAILY: '1',
      });
      instances.push(redis);
      const now = Date.now();
      await service.checkIpRequestLimits('203.0.113.3', now);
      const second = await service.checkIpRequestLimits('203.0.113.3', now + 1);
      expect(second.allowed).toBe(false);
    });
  });

  describe('invalidated-code streak blocking', () => {
    it('does not block before reaching the threshold', async () => {
      const { service, redis } = makeService({
        RATE_LIMIT_INVALIDATED_STREAK_THRESHOLD: '3',
      });
      instances.push(redis);
      const first = await service.recordInvalidatedCode('+989120000005');
      const second = await service.recordInvalidatedCode('+989120000005');
      expect(first.blocked).toBe(false);
      expect(second.blocked).toBe(false);
    });

    it('blocks on reaching the threshold and getPhoneBlockRetryAfterSeconds reflects it', async () => {
      const { service, redis } = makeService({
        RATE_LIMIT_INVALIDATED_STREAK_THRESHOLD: '3',
        RATE_LIMIT_BLOCK_SECONDS: '1800',
      });
      instances.push(redis);
      const phone = '+989120000006';

      await service.recordInvalidatedCode(phone);
      await service.recordInvalidatedCode(phone);
      const third = await service.recordInvalidatedCode(phone);

      expect(third.blocked).toBe(true);
      expect(third.retryAfterSeconds).toBe(1800);

      const retryAfter = await service.getPhoneBlockRetryAfterSeconds(phone);
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(1800);
    });

    it('getPhoneBlockRetryAfterSeconds returns null when not blocked', async () => {
      const { service, redis } = makeService();
      instances.push(redis);
      const retryAfter =
        await service.getPhoneBlockRetryAfterSeconds('+989120000007');
      expect(retryAfter).toBeNull();
    });

    it('clearInvalidatedStreak resets the streak counter', async () => {
      const { service, redis } = makeService({
        RATE_LIMIT_INVALIDATED_STREAK_THRESHOLD: '3',
      });
      instances.push(redis);
      const phone = '+989120000008';

      await service.recordInvalidatedCode(phone);
      await service.recordInvalidatedCode(phone);
      await service.clearInvalidatedStreak(phone);

      const third = await service.recordInvalidatedCode(phone);
      const fourth = await service.recordInvalidatedCode(phone);
      expect(third.blocked).toBe(false);
      expect(fourth.blocked).toBe(false);
    });
  });
});
