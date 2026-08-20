import { fakeConfig } from '../../test-support/fake-config';
import { RedisService } from './redis.service';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6380';

describe('RedisService', () => {
  const instances: RedisService[] = [];

  afterEach(async () => {
    for (const service of instances.splice(0)) {
      await service.client.quit();
    }
  });

  function makeService(overrides: Record<string, string> = {}): RedisService {
    const service = new RedisService(fakeConfig({ REDIS_URL, ...overrides }));
    instances.push(service);
    return service;
  }

  it('key() prefixes and joins parts with REDIS_PREFIX', () => {
    const service = makeService({ REDIS_PREFIX: 'vaqt:test:' });
    expect(service.key('a', 'b', 'c')).toBe('vaqt:test:a:b:c');
  });

  it('key() with no configured prefix falls back to an empty string', () => {
    const service = makeService();
    expect(service.key('a', 'b')).toBe('a:b');
  });

  it('onModuleDestroy closes the underlying connection', async () => {
    const service = new RedisService(fakeConfig({ REDIS_URL }));
    await expect(service.onModuleDestroy()).resolves.toBeUndefined();
  });
});
