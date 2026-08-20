import { fakeConfig } from '../../test-support/fake-config';
import { randomTestRedisPrefix } from '../../test-support/test-db';
import { RedisService } from '../../common/redis/redis.service';
import { OtpPendingCodeStore } from './otp-pending-code.store';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6380';

function makeStore(): { store: OtpPendingCodeStore; redis: RedisService } {
  const redis = new RedisService(
    fakeConfig({ REDIS_URL, REDIS_PREFIX: randomTestRedisPrefix() }),
  );
  return { store: new OtpPendingCodeStore(redis), redis };
}

describe('OtpPendingCodeStore', () => {
  let redis: RedisService;

  afterEach(async () => {
    await redis.client.quit();
  });

  it('set() then get() round-trips the code', async () => {
    const created = makeStore();
    redis = created.redis;
    await created.store.set('+989123456789', '12345', 60);
    await expect(created.store.get('+989123456789')).resolves.toBe('12345');
  });

  it('set() with ttlSeconds <= 0 is a no-op (never writes to Redis)', async () => {
    const created = makeStore();
    redis = created.redis;
    await created.store.set('+989123456789', '12345', 0);
    await expect(created.store.get('+989123456789')).resolves.toBeNull();
  });

  it('set() with a negative ttlSeconds is also a no-op', async () => {
    const created = makeStore();
    redis = created.redis;
    await created.store.set('+989123456789', '12345', -5);
    await expect(created.store.get('+989123456789')).resolves.toBeNull();
  });

  it('get() returns null when nothing was ever set for the phone', async () => {
    const created = makeStore();
    redis = created.redis;
    await expect(created.store.get('+989120000000')).resolves.toBeNull();
  });

  it('clear() removes the stored code', async () => {
    const created = makeStore();
    redis = created.redis;
    await created.store.set('+989123456789', '12345', 60);
    await created.store.clear('+989123456789');
    await expect(created.store.get('+989123456789')).resolves.toBeNull();
  });
});
