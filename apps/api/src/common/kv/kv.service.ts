import { Injectable } from '@nestjs/common';
import { Prisma, prisma } from '@vaqt/db';

// Postgres-backed key/value store with TTL and counters, plus a sliding-window
// rate limiter. It replaces the Redis the app used to need: every method is a
// single atomic SQL statement (or one transaction under an advisory lock), so
// concurrent callers can't race. Expiry is evaluated against the database
// clock in UTC on every read; expired rows are purged by purgeExpired().
const NOW_UTC = Prisma.sql`(now() AT TIME ZONE 'UTC')`;

@Injectable()
export class KvService {
  key(...parts: string[]): string {
    return parts.join(':');
  }

  async get(key: string): Promise<string | null> {
    const rows = await prisma.$queryRaw<{ value: string }[]>`
      SELECT "value" FROM kv_entries
      WHERE "key" = ${key} AND ("expiresAt" IS NULL OR "expiresAt" > ${NOW_UTC})`;
    return rows[0]?.value ?? null;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    await prisma.$executeRaw`
      INSERT INTO kv_entries ("key", "value", "expiresAt")
      VALUES (${key}, ${value}, CASE WHEN ${ttlSeconds ?? null}::double precision IS NULL
        THEN NULL ELSE ${NOW_UTC} + make_interval(secs => ${ttlSeconds ?? null}::double precision) END)
      ON CONFLICT ("key") DO UPDATE
        SET "value" = EXCLUDED."value", "expiresAt" = EXCLUDED."expiresAt"`;
  }

  /** Sets only if the key is absent or expired. Returns true when it was set. */
  async setIfAbsent(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    const rows = await prisma.$queryRaw<{ key: string }[]>`
      INSERT INTO kv_entries ("key", "value", "expiresAt")
      VALUES (${key}, ${value}, ${NOW_UTC} + make_interval(secs => ${ttlSeconds}::double precision))
      ON CONFLICT ("key") DO UPDATE
        SET "value" = EXCLUDED."value", "expiresAt" = EXCLUDED."expiresAt"
        WHERE kv_entries."expiresAt" IS NOT NULL AND kv_entries."expiresAt" <= ${NOW_UTC}
      RETURNING "key"`;
    return rows.length > 0;
  }

  async del(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    // Also drops rate-limit windows stored under the same key (like DEL did
    // for a Redis sorted set).
    await prisma.$executeRaw`DELETE FROM rate_events WHERE "key" = ANY(${keys})`;
    return prisma.$executeRaw`DELETE FROM kv_entries WHERE "key" = ANY(${keys})`;
  }

  /** Reads and deletes in one step (single-use codes). */
  async getAndDelete(key: string): Promise<string | null> {
    const rows = await prisma.$queryRaw<{ value: string }[]>`
      DELETE FROM kv_entries
      WHERE "key" = ${key}
      RETURNING "value", ("expiresAt" IS NOT NULL AND "expiresAt" <= ${NOW_UTC}) AS expired`;
    const row = rows[0] as { value: string; expired?: boolean } | undefined;
    return row && !row.expired ? row.value : null;
  }

  /**
   * Atomically adds one to a counter and returns the new value. The TTL starts
   * when the counter is created (or has expired); `refreshTtl` restarts it on
   * every call.
   */
  async increment(
    key: string,
    ttlSeconds: number,
    refreshTtl = false,
  ): Promise<number> {
    const rows = await prisma.$queryRaw<{ value: string }[]>`
      INSERT INTO kv_entries ("key", "value", "expiresAt")
      VALUES (${key}, '1', ${NOW_UTC} + make_interval(secs => ${ttlSeconds}::double precision))
      ON CONFLICT ("key") DO UPDATE SET
        "value" = CASE WHEN kv_entries."expiresAt" IS NOT NULL AND kv_entries."expiresAt" <= ${NOW_UTC}
          THEN '1' ELSE (kv_entries."value"::int + 1)::text END,
        "expiresAt" = CASE
          WHEN ${refreshTtl}::boolean OR (kv_entries."expiresAt" IS NOT NULL AND kv_entries."expiresAt" <= ${NOW_UTC})
          THEN ${NOW_UTC} + make_interval(secs => ${ttlSeconds}::double precision)
          ELSE kv_entries."expiresAt" END
      RETURNING "value"`;
    return Number(rows[0].value);
  }

  /** Seconds left: -2 if the key doesn't exist (or expired), -1 if it never expires. */
  async ttl(key: string): Promise<number> {
    const rows = await prisma.$queryRaw<{ ttl: number | null }[]>`
      SELECT CEIL(EXTRACT(EPOCH FROM ("expiresAt" - ${NOW_UTC})))::int AS ttl
      FROM kv_entries WHERE "key" = ${key}`;
    if (rows.length === 0) return -2;
    const ttl = rows[0].ttl;
    if (ttl === null) return -1;
    return ttl > 0 ? ttl : -2;
  }

  /**
   * Sliding-window rate limit. Every call is recorded — accepted or not — so
   * hammering the endpoint can't dodge the limit. Atomic per key via an
   * advisory transaction lock. Returns [allowed, retryAfterSeconds].
   */
  async slidingWindow(
    key: string,
    nowMs: number,
    windowMs: number,
    limit: number,
  ): Promise<[boolean, number]> {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
      await tx.$executeRaw`DELETE FROM rate_events WHERE "key" = ${key} AND "at" <= ${nowMs - windowMs}`;
      await tx.$executeRaw`INSERT INTO rate_events ("key", "at") VALUES (${key}, ${nowMs})`;
      const [stats] = await tx.$queryRaw<{ count: bigint; oldest: bigint }[]>`
        SELECT COUNT(*) AS count, MIN("at") AS oldest FROM rate_events WHERE "key" = ${key}`;
      if (Number(stats.count) <= limit) return [true, 0];
      const retryAfter = Math.max(
        1,
        Math.ceil((Number(stats.oldest) + windowMs - nowMs) / 1000),
      );
      return [false, retryAfter];
    });
  }

  /** Housekeeping: drops expired keys and stale rate-limit events. */
  async purgeExpired(maxWindowMs = 24 * 60 * 60 * 1000): Promise<void> {
    await prisma.$executeRaw`DELETE FROM kv_entries WHERE "expiresAt" IS NOT NULL AND "expiresAt" <= ${NOW_UTC}`;
    await prisma.$executeRaw`DELETE FROM rate_events WHERE "at" <= ${Date.now() - maxWindowMs}`;
  }
}
