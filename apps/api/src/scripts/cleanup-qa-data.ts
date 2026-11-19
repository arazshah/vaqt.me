// Removes QA/manual-testing leftovers from the local dev Postgres + Redis.
//
// Detection: a user is a candidate only if its phone starts with
// TEST_PHONE_PREFIX — the range test-support/test-db.ts reserves for throwaway
// users. Nothing else (name, age alone) is a signal, so a real person using
// the local app is never at risk. `createdAt` age is an extra margin so a
// session you are driving right now isn't swept mid-run.
//
// Cards, links, services, availability and bookings cascade with the user;
// sessions, verification codes and audit logs don't, so they are deleted
// explicitly (in the same transaction).
import Redis from 'ioredis';
import { prisma } from '@vaqt/db';
import { maskPhone } from '../common/utils/mask-phone';
import { TEST_PHONE_PREFIX } from '../test-support/test-db';

const DEFAULT_OLDER_THAN_MINUTES = 10;

export interface CleanupOptions {
  execute: boolean;
  olderThanMinutes: number;
}

export interface CleanupCandidate {
  id: string;
  phone: string;
  displayName: string;
  createdAt: Date;
}

export function assertSafeToRun(env: {
  databaseUrl: string | undefined;
  nodeEnv: string | undefined;
}): void {
  if (env.nodeEnv === 'production') {
    throw new Error('refusing to run: NODE_ENV=production.');
  }
  if (!env.databaseUrl) {
    throw new Error('refusing to run: DATABASE_URL is not set.');
  }
  let host: string;
  try {
    host = new URL(env.databaseUrl).hostname;
  } catch {
    throw new Error('refusing to run: DATABASE_URL is not a valid URL.');
  }
  if (host !== 'localhost' && host !== '127.0.0.1') {
    throw new Error(
      `refusing to run: DATABASE_URL host "${host}" is not localhost/127.0.0.1.`,
    );
  }
}

export async function findCandidates(
  olderThanMinutes: number,
): Promise<CleanupCandidate[]> {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);
  return prisma.user.findMany({
    where: {
      phone: { startsWith: TEST_PHONE_PREFIX },
      createdAt: { lte: cutoff },
    },
    select: { id: true, phone: true, displayName: true, createdAt: true },
  });
}

export async function deleteCandidates(
  candidates: CleanupCandidate[],
): Promise<{ users: number; sessions: number }> {
  const ids = candidates.map((c) => c.id);
  const phones = candidates.map((c) => c.phone);
  const [sessions, , , , users] = await prisma.$transaction([
    prisma.session.deleteMany({ where: { userId: { in: ids } } }),
    prisma.auditLog.deleteMany({ where: { actorId: { in: ids } } }),
    prisma.verificationCode.deleteMany({ where: { phone: { in: phones } } }),
    // Bookings reference both sides; bookerId rows cascade via User.
    prisma.booking.deleteMany({
      where: { OR: [{ providerId: { in: ids } }, { bookerId: { in: ids } }] },
    }),
    prisma.user.deleteMany({ where: { id: { in: ids } } }),
  ]);
  return { users: users.count, sessions: sessions.count };
}

export async function cleanupRedis(
  candidates: CleanupCandidate[],
  redis: Redis,
  prefix: string,
): Promise<number> {
  const keys = candidates.flatMap((c) => [
    `${prefix}otp:pending-code:${c.phone}`,
    `${prefix}otp:invalidated-streak:${c.phone}`,
    `${prefix}otp:blocked:${c.phone}`,
    `${prefix}ratelimit:otp-resend:${c.phone}`,
    `${prefix}ratelimit:otp-phone-hour:${c.phone}`,
    `${prefix}ratelimit:otp-phone-day:${c.phone}`,
    `${prefix}verified-phone:${c.id}`,
    `${prefix}system-role:${c.id}`,
  ]);
  return keys.length === 0 ? 0 : redis.del(...keys);
}

export async function runCleanup(options: CleanupOptions): Promise<void> {
  assertSafeToRun({
    databaseUrl: process.env.DATABASE_URL,
    nodeEnv: process.env.NODE_ENV,
  });
  const candidates = await findCandidates(options.olderThanMinutes);
  console.log(
    `[cleanup-qa-data] ${options.execute ? 'EXECUTE' : 'DRY RUN'} — ${String(candidates.length)} candidate user(s)`,
  );
  for (const c of candidates) {
    console.log(`  - ${c.id}  ${maskPhone(c.phone)}  "${c.displayName}"`);
  }
  if (!options.execute || candidates.length === 0) return;

  const counts = await deleteCandidates(candidates);
  console.log(
    `[cleanup-qa-data] deleted ${String(counts.users)} user(s), ${String(counts.sessions)} session(s).`,
  );
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    const redis = new Redis(redisUrl);
    try {
      const removed = await cleanupRedis(
        candidates,
        redis,
        process.env.REDIS_PREFIX ?? '',
      );
      console.log(`[cleanup-qa-data] removed ${String(removed)} Redis key(s).`);
    } catch (error) {
      console.warn('[cleanup-qa-data] Redis cleanup failed:', error);
    } finally {
      redis.disconnect();
    }
  }
}

export function parseCliArgs(argv: string[]): CleanupOptions {
  let execute = false;
  let olderThanMinutes = DEFAULT_OLDER_THAN_MINUTES;
  for (const arg of argv) {
    if (arg === '--execute') execute = true;
    else if (arg === '--dry-run') continue;
    else if (arg.startsWith('--older-than-minutes=')) {
      const value = Number(arg.slice('--older-than-minutes='.length));
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(`invalid --older-than-minutes value: "${arg}"`);
      }
      olderThanMinutes = value;
    } else {
      throw new Error(`unrecognized argument: "${arg}"`);
    }
  }
  return { execute, olderThanMinutes };
}

/* istanbul ignore next -- exercised via `pnpm --filter @vaqt/api cleanup:qa` */
if (require.main === module) {
  runCleanup(parseCliArgs(process.argv.slice(2)))
    .then(async () => {
      await prisma.$disconnect();
      process.exit(0);
    })
    .catch(async (error: unknown) => {
      console.error('[cleanup-qa-data] failed:', error);
      await prisma.$disconnect();
      process.exit(1);
    });
}
