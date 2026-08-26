// Removes QA/manual-testing leftovers from the local dev Postgres + Redis.
//
// Detection criterion (decided explicitly with the project owner, not
// guessed): a user is a cleanup candidate only if its phone starts with
// TEST_PHONE_PREFIX (+9899...) — the exact range apps/api/src/test-support
// /test-db.ts already reserves for jest's own throwaway users. Nothing else
// (display name, age alone, request/offer shape) is used as a signal, so a
// real person poking at the local app with a real-looking phone number is
// never at risk — only rows created with this specific reserved prefix can
// ever match. `createdAt` age is an *additional* safety margin on top of
// that, not a replacement for it: it exists so a session you're actively
// driving through a QA script right now (which necessarily also uses this
// prefix) can't be swept out from under you mid-run.
//
// Deletion is scoped to rows *owned by* a candidate (their own requests,
// offers, conversations, orders, ...) — never matched independently. If a
// candidate happens to have offered on a real seed request, only the
// candidate's own offer/conversation/messages disappear; the real request
// and its `offerCount` (a documented cumulative counter, see
// offers.service.ts, never decremented even on withdrawal) are untouched.
import Redis from 'ioredis';
import { prisma } from '@vaqt/db';
import { maskPhone } from '../common/utils/mask-phone';
import { TEST_PHONE_PREFIX } from '../test-support/test-db';

const DEFAULT_OLDER_THAN_MINUTES = 10;

// Seed rows (packages/db/src/seed.ts) always use human-readable fixed ids
// like "usr-seeker-1", never Prisma's cuid() shape, and seed phones
// (0912000000X) don't start with TEST_PHONE_PREFIX either — so this should
// be structurally impossible to trip. It's a defense-in-depth assertion,
// not the primary detection signal; if it ever fires, something is badly
// wrong and we must abort rather than risk touching seed data.
const SEED_ID_PATTERN = /^(usr|req|cat|skill|offer|conv|msg|prod|review)-/;

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

export interface CleanupPlan {
  candidates: CleanupCandidate[];
  requestIds: string[];
  conversationIds: string[];
  orderIds: string[];
}

export interface CleanupCounts {
  users: number;
  requests: number;
  offers: number;
  conversations: number;
  messages: number;
  reviews: number;
  orders: number;
  entitlements: number;
  subscriptions: number;
  aiSessions: number;
  sessions: number;
  auditLogs: number;
  reports: number;
  notifications: number;
  verificationCodes: number;
}

export interface CleanupResult {
  plan: CleanupPlan;
  executed: boolean;
  counts: CleanupCounts | null;
}

export function assertSafeToRun(env: {
  databaseUrl: string | undefined;
  nodeEnv: string | undefined;
}): void {
  if (env.nodeEnv === 'production') {
    throw new Error(
      'refusing to run: NODE_ENV=production. This script must never touch a production database.',
    );
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
  const allowedHosts = new Set(['localhost', '127.0.0.1']);
  if (!allowedHosts.has(host)) {
    throw new Error(
      `refusing to run: DATABASE_URL host "${host}" is not localhost/127.0.0.1 — ` +
        'this script only ever runs against the local docker-compose Postgres.',
    );
  }
}

function assertNoSeedRowsMatched(candidates: CleanupCandidate[]): void {
  const seedMatches = candidates.filter((c) => SEED_ID_PATTERN.test(c.id));
  if (seedMatches.length > 0) {
    throw new Error(
      `refusing to proceed: ${String(seedMatches.length)} candidate(s) have a seed-shaped id ` +
        `(${seedMatches.map((c) => c.id).join(', ')}) despite matching the test-phone prefix — ` +
        'this should be structurally impossible. Aborting rather than risk deleting seed data.',
    );
  }
}

export async function findCandidates(
  olderThanMinutes: number,
): Promise<CleanupCandidate[]> {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);
  const candidates = await prisma.user.findMany({
    where: {
      phone: { startsWith: TEST_PHONE_PREFIX },
      createdAt: { lte: cutoff },
    },
    select: { id: true, phone: true, displayName: true, createdAt: true },
  });
  assertNoSeedRowsMatched(candidates);
  return candidates;
}

export async function buildCleanupPlan(
  candidates: CleanupCandidate[],
): Promise<CleanupPlan> {
  if (candidates.length === 0) {
    return { candidates, requestIds: [], conversationIds: [], orderIds: [] };
  }
  const userIds = candidates.map((c) => c.id);

  const requests = await prisma.request.findMany({
    where: { ownerId: { in: userIds } },
    select: { id: true },
  });
  const requestIds = requests.map((r) => r.id);

  const conversations = await prisma.conversation.findMany({
    where: {
      OR: [
        { seekerId: { in: userIds } },
        { providerId: { in: userIds } },
        { requestId: { in: requestIds } },
      ],
    },
    select: { id: true },
  });
  const conversationIds = conversations.map((c) => c.id);

  const orders = await prisma.order.findMany({
    where: {
      OR: [{ userId: { in: userIds } }, { requestId: { in: requestIds } }],
    },
    select: { id: true },
  });
  const orderIds = orders.map((o) => o.id);

  return { candidates, requestIds, conversationIds, orderIds };
}

// Deletion order matters: several relations here have a real Postgres FK
// with no cascade (see packages/db/prisma/schema.prisma) — children must go
// before parents or Postgres rejects the delete outright (verified live:
// deleting an Order while a Subscription still referenced it failed with
// `subscriptions_orderId_fkey`). RequestSkill/UserSkill aren't listed
// explicitly — both declare `onDelete: Cascade` on their Request/User
// relation, so Postgres removes them automatically when the parent row
// goes.
export async function executeCleanupPlan(
  plan: CleanupPlan,
): Promise<CleanupCounts> {
  const userIds = plan.candidates.map((c) => c.id);
  const phones = plan.candidates.map((c) => c.phone);
  const { requestIds, conversationIds, orderIds } = plan;

  const [
    subscriptions,
    entitlements,
    orders,
    messages,
    reviews,
    conversations,
    offers,
    aiSessions,
    requests,
    sessions,
    auditLogs,
    reports,
    notifications,
    verificationCodes,
    users,
  ] = await prisma.$transaction([
    prisma.subscription.deleteMany({
      where: {
        OR: [{ userId: { in: userIds } }, { orderId: { in: orderIds } }],
      },
    }),
    prisma.entitlement.deleteMany({
      where: {
        OR: [
          { userId: { in: userIds } },
          { requestId: { in: requestIds } },
          { orderId: { in: orderIds } },
        ],
      },
    }),
    prisma.order.deleteMany({ where: { id: { in: orderIds } } }),
    prisma.message.deleteMany({
      where: {
        OR: [
          { senderId: { in: userIds } },
          { conversationId: { in: conversationIds } },
        ],
      },
    }),
    prisma.review.deleteMany({
      where: {
        OR: [
          { reviewerId: { in: userIds } },
          { revieweeId: { in: userIds } },
          { conversationId: { in: conversationIds } },
        ],
      },
    }),
    prisma.conversation.deleteMany({ where: { id: { in: conversationIds } } }),
    prisma.offer.deleteMany({
      where: {
        OR: [
          { providerId: { in: userIds } },
          { requestId: { in: requestIds } },
        ],
      },
    }),
    prisma.aiSession.deleteMany({
      where: {
        OR: [{ userId: { in: userIds } }, { requestId: { in: requestIds } }],
      },
    }),
    prisma.request.deleteMany({ where: { id: { in: requestIds } } }),
    prisma.session.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } }),
    prisma.report.deleteMany({
      where: {
        OR: [
          { reporterId: { in: userIds } },
          { targetUserId: { in: userIds } },
        ],
      },
    }),
    prisma.notification.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.verificationCode.deleteMany({ where: { phone: { in: phones } } }),
    prisma.user.deleteMany({ where: { id: { in: userIds } } }),
  ]);

  return {
    users: users.count,
    requests: requests.count,
    offers: offers.count,
    conversations: conversations.count,
    messages: messages.count,
    reviews: reviews.count,
    orders: orders.count,
    entitlements: entitlements.count,
    subscriptions: subscriptions.count,
    aiSessions: aiSessions.count,
    sessions: sessions.count,
    auditLogs: auditLogs.count,
    reports: reports.count,
    notifications: notifications.count,
    verificationCodes: verificationCodes.count,
  };
}

function redisKey(prefix: string, ...parts: string[]): string {
  return `${prefix}${parts.join(':')}`;
}

// Best-effort: every key touched here already self-expires within 30-60s
// (see require-verified-phone.guard.ts / roles.guard.ts / rate-limit
// service TTLs), so a Redis failure here never leaves permanent state —
// it's cleanliness, not correctness.
export async function cleanupRedisForPlan(
  plan: CleanupPlan,
  redis: Redis,
  redisPrefix: string,
): Promise<number> {
  const keys: string[] = [];
  for (const candidate of plan.candidates) {
    keys.push(
      redisKey(redisPrefix, 'otp', 'pending-code', candidate.phone),
      redisKey(redisPrefix, 'otp', 'invalidated-streak', candidate.phone),
      redisKey(redisPrefix, 'otp', 'blocked', candidate.phone),
      redisKey(redisPrefix, 'ratelimit', 'otp-resend', candidate.phone),
      redisKey(redisPrefix, 'ratelimit', 'otp-phone-hour', candidate.phone),
      redisKey(redisPrefix, 'ratelimit', 'otp-phone-day', candidate.phone),
      redisKey(redisPrefix, 'verified-phone', candidate.id),
      redisKey(redisPrefix, 'system-role', candidate.id),
    );
  }
  if (keys.length === 0) {
    return 0;
  }
  return redis.del(...keys);
}

function printSummary(plan: CleanupPlan, mode: 'DRY RUN' | 'EXECUTE'): void {
  console.log(
    `[cleanup-qa-data] mode: ${mode} — found ${String(plan.candidates.length)} candidate user(s)`,
  );
  for (const c of plan.candidates) {
    console.log(
      `  - ${c.id}  ${maskPhone(c.phone)}  "${c.displayName}"  created ${c.createdAt.toISOString()}`,
    );
  }
  console.log(
    `  owned requests: ${String(plan.requestIds.length)}, ` +
      `conversations: ${String(plan.conversationIds.length)}, ` +
      `orders: ${String(plan.orderIds.length)}`,
  );
}

export async function runCleanup(
  options: CleanupOptions,
): Promise<CleanupResult> {
  assertSafeToRun({
    databaseUrl: process.env.DATABASE_URL,
    nodeEnv: process.env.NODE_ENV,
  });

  const candidates = await findCandidates(options.olderThanMinutes);
  const plan = await buildCleanupPlan(candidates);

  printSummary(plan, options.execute ? 'EXECUTE' : 'DRY RUN');

  if (plan.candidates.length === 0) {
    console.log('[cleanup-qa-data] nothing to do.');
    return { plan, executed: false, counts: null };
  }

  if (!options.execute) {
    console.log(
      '[cleanup-qa-data] dry run only — pass --execute to actually delete the rows above.',
    );
    return { plan, executed: false, counts: null };
  }

  const counts = await executeCleanupPlan(plan);

  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    const redis = new Redis(redisUrl);
    try {
      const removedKeys = await cleanupRedisForPlan(
        plan,
        redis,
        process.env.REDIS_PREFIX ?? '',
      );
      console.log(
        `[cleanup-qa-data] removed ${String(removedKeys)} Redis key(s).`,
      );
    } catch (error) {
      console.warn(
        '[cleanup-qa-data] Redis cleanup failed (Postgres rows were still deleted); ' +
          'these keys self-expire within 30-60s regardless:',
        error,
      );
    } finally {
      redis.disconnect();
    }
  }

  console.log('[cleanup-qa-data] done:', counts);
  return { plan, executed: true, counts };
}

export function parseCliArgs(argv: string[]): CleanupOptions {
  let execute = false;
  let olderThanMinutes = DEFAULT_OLDER_THAN_MINUTES;
  for (const arg of argv) {
    if (arg === '--execute') {
      execute = true;
    } else if (arg === '--dry-run') {
      // Explicit no-op: dry-run is already the default without --execute.
      continue;
    } else if (arg.startsWith('--older-than-minutes=')) {
      const raw = arg.slice('--older-than-minutes='.length);
      const value = Number(raw);
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

/* istanbul ignore next -- exercised via `pnpm --filter @vaqt/api cleanup:qa`, not jest */
if (require.main === module) {
  const options = parseCliArgs(process.argv.slice(2));
  runCleanup(options)
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
