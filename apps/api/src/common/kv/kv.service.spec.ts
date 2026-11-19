import { randomUUID } from 'node:crypto';
import { KvService } from './kv.service';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('KvService (real Postgres)', () => {
  const kv = new KvService();
  const k = () => kv.key('test', randomUUID());

  it('key() joins parts with ":"', () => {
    expect(kv.key('a', 'b', 'c')).toBe('a:b:c');
  });

  it('set/get/del round-trip, overwrite, and missing key', async () => {
    const key = k();
    expect(await kv.get(key)).toBeNull();
    await kv.set(key, 'one');
    await kv.set(key, 'two');
    expect(await kv.get(key)).toBe('two');
    expect(await kv.del(key, k())).toBe(1);
    expect(await kv.get(key)).toBeNull();
    expect(await kv.del()).toBe(0);
  });

  it('expired keys read as missing, ttl() reports remaining/never/missing', async () => {
    const key = k();
    await kv.set(key, 'x', 1);
    const ttl = await kv.ttl(key);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(1);
    await sleep(1200);
    expect(await kv.get(key)).toBeNull();
    expect(await kv.ttl(key)).toBe(-2);

    const forever = k();
    await kv.set(forever, 'x');
    expect(await kv.ttl(forever)).toBe(-1);
    expect(await kv.ttl(k())).toBe(-2);
  });

  it('setIfAbsent only wins when the key is free or expired', async () => {
    const key = k();
    expect(await kv.setIfAbsent(key, 'a', 1)).toBe(true);
    expect(await kv.setIfAbsent(key, 'b', 60)).toBe(false);
    expect(await kv.get(key)).toBe('a');
    await sleep(1200);
    expect(await kv.setIfAbsent(key, 'c', 60)).toBe(true);
    expect(await kv.get(key)).toBe('c');
  });

  it('getAndDelete returns the value once, never an expired one', async () => {
    const key = k();
    await kv.set(key, 'code', 60);
    expect(await kv.getAndDelete(key)).toBe('code');
    expect(await kv.getAndDelete(key)).toBeNull();

    const old = k();
    await kv.set(old, 'stale', 1);
    await sleep(1200);
    expect(await kv.getAndDelete(old)).toBeNull();
  });

  it('increment counts atomically under concurrency', async () => {
    const key = k();
    const results = await Promise.all(
      Array.from({ length: 20 }, () => kv.increment(key, 60)),
    );
    expect([...results].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1),
    );
  });

  it('increment restarts after expiry, and refreshTtl extends the window', async () => {
    const key = k();
    expect(await kv.increment(key, 1)).toBe(1);
    expect(await kv.increment(key, 1)).toBe(2);
    await sleep(1200);
    expect(await kv.increment(key, 1)).toBe(1);

    const refreshed = k();
    await kv.increment(refreshed, 1);
    await sleep(700);
    await kv.increment(refreshed, 1, true);
    await sleep(700);
    expect(await kv.increment(refreshed, 1)).toBe(3);
  });

  it('slidingWindow lets exactly `limit` through under concurrency', async () => {
    const key = k();
    const now = Date.now();
    const results = await Promise.all(
      Array.from({ length: 10 }, () => kv.slidingWindow(key, now, 60_000, 5)),
    );
    expect(results.filter(([allowed]) => allowed)).toHaveLength(5);
  });

  it('slidingWindow rejected calls still occupy a slot and report retry-after', async () => {
    const key = k();
    const now = Date.now();
    expect(await kv.slidingWindow(key, now, 10_000, 1)).toEqual([true, 0]);
    const [allowed, retryAfter] = await kv.slidingWindow(
      key,
      now + 2_000,
      10_000,
      1,
    );
    expect(allowed).toBe(false);
    expect(retryAfter).toBe(8);
    // Window slides: the first hit has aged out, but the rejected hit counts.
    const later = await kv.slidingWindow(key, now + 11_000, 10_000, 1);
    expect(later[0]).toBe(false);
    const much = await kv.slidingWindow(key, now + 40_000, 10_000, 1);
    expect(much).toEqual([true, 0]);
  });

  it('del() also clears a rate-limit window under the same key', async () => {
    const key = k();
    const now = Date.now();
    await kv.slidingWindow(key, now, 60_000, 1);
    expect((await kv.slidingWindow(key, now + 1, 60_000, 1))[0]).toBe(false);
    await kv.del(key);
    expect(await kv.slidingWindow(key, now + 2, 60_000, 1)).toEqual([true, 0]);
  });

  it('purgeExpired removes expired keys and old rate events', async () => {
    const key = k();
    await kv.set(key, 'x', 1);
    await kv.slidingWindow(k(), Date.now() - 2 * 24 * 3600 * 1000, 1000, 5);
    await sleep(1200);
    await kv.purgeExpired();
    expect(await kv.ttl(key)).toBe(-2);
  });
});
