import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { randomTestRedisPrefix } from '../../test-support/test-db';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6380';

// Proves REDIS_PREFIX actually reaches BullMQ's own Redis keys — the same
// `${REDIS_PREFIX}bull` value BullRedisModule passes as BullMQ's `prefix`
// option (see bull-redis.module.ts), applied here directly against a real
// Queue instance rather than going through Nest DI.
describe('BullMQ REDIS_PREFIX', () => {
  it('namespaces every key BullMQ writes under `${REDIS_PREFIX}bull`', async () => {
    const redisPrefix = randomTestRedisPrefix();
    const bullPrefix = `${redisPrefix}bull`;
    const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
    const queueName = 'prefix-proof';

    const queue = new Queue(queueName, { connection, prefix: bullPrefix });
    await queue.add('job', { hello: 'world' });

    const scanClient = new Redis(REDIS_URL);
    const matchingKeys = await scanClient.keys(`${bullPrefix}:${queueName}:*`);
    const anyKeyWithoutPrefix = await scanClient.keys(`*:${queueName}:*`);

    expect(matchingKeys.length).toBeGreaterThan(0);
    // Every key for this queue name must live under our namespaced prefix —
    // none of them should exist outside it.
    expect(anyKeyWithoutPrefix.every((key) => key.startsWith(bullPrefix))).toBe(
      true,
    );

    await queue.obliterate({ force: true });
    await queue.close();
    await connection.quit();
    await scanClient.quit();
  });
});
