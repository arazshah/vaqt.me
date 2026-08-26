import Redis from 'ioredis';
import { prisma } from '@vaqt/db';
import {
  createTestUser,
  randomTestPhone,
  randomTestRedisPrefix,
} from '../test-support/test-db';
import {
  assertSafeToRun,
  buildCleanupPlan,
  cleanupRedisForPlan,
  executeCleanupPlan,
  findCandidates,
  parseCliArgs,
  runCleanup,
  type CleanupCandidate,
} from './cleanup-qa-data';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6380';

// Category/Product fixtures created here, not assumed from packages/db/seed —
// CI runs `prisma migrate deploy` without seeding, so relying on seed ids
// like 'cat-programming' fails there with a foreign key violation even
// though it passes locally against a seeded dev database.
let CATEGORY_ID: string;

beforeAll(async () => {
  const category = await prisma.category.create({
    data: {
      name: 'دسته تست پاکسازی QA',
      slug: `test-cat-cleanup-${String(Date.now())}-${String(Math.random())}`,
      isActive: true,
    },
  });
  CATEGORY_ID = category.id;

  for (const product of [
    {
      code: 'URGENT_BADGE' as const,
      title: 'نشان فوری',
      description: 'تست',
      priceRial: 490_000,
      durationHours: null,
    },
    {
      code: 'PRO_MONTHLY' as const,
      title: 'اشتراک حرفه‌ای ماهانه',
      description: 'تست',
      priceRial: 2_990_000,
      durationHours: 720,
    },
  ]) {
    await prisma.product.upsert({
      where: { code: product.code },
      create: product,
      update: product,
    });
  }
});

describe('parseCliArgs', () => {
  it('defaults to a dry run with a 10 minute cutoff', () => {
    expect(parseCliArgs([])).toEqual({
      execute: false,
      olderThanMinutes: 10,
    });
  });

  it('turns on execute with --execute', () => {
    expect(parseCliArgs(['--execute']).execute).toBe(true);
  });

  it('treats --dry-run as a no-op (already the default)', () => {
    expect(parseCliArgs(['--dry-run'])).toEqual({
      execute: false,
      olderThanMinutes: 10,
    });
  });

  it('parses --older-than-minutes=N', () => {
    expect(parseCliArgs(['--older-than-minutes=45']).olderThanMinutes).toBe(45);
  });

  it('rejects a non-numeric --older-than-minutes value', () => {
    expect(() => parseCliArgs(['--older-than-minutes=soon'])).toThrow(
      /invalid --older-than-minutes/,
    );
  });

  it('rejects a negative --older-than-minutes value', () => {
    expect(() => parseCliArgs(['--older-than-minutes=-1'])).toThrow(
      /invalid --older-than-minutes/,
    );
  });

  it('rejects an unrecognized argument', () => {
    expect(() => parseCliArgs(['--force'])).toThrow(
      /unrecognized argument: "--force"/,
    );
  });
});

describe('assertSafeToRun', () => {
  it('refuses to run under NODE_ENV=production', () => {
    expect(() => {
      assertSafeToRun({
        databaseUrl: 'postgresql://vaqt:vaqt@localhost:5432/vaqt',
        nodeEnv: 'production',
      });
    }).toThrow(/NODE_ENV=production/);
  });

  it('refuses to run without a DATABASE_URL', () => {
    expect(() => {
      assertSafeToRun({ databaseUrl: undefined, nodeEnv: 'development' });
    }).toThrow(/DATABASE_URL is not set/);
  });

  it('refuses to run with a malformed DATABASE_URL', () => {
    expect(() => {
      assertSafeToRun({ databaseUrl: 'not-a-url', nodeEnv: 'development' });
    }).toThrow(/not a valid URL/);
  });

  it('refuses to run against a non-localhost host', () => {
    expect(() => {
      assertSafeToRun({
        databaseUrl: 'postgresql://vaqt:vaqt@prod.example.com:5432/vaqt',
        nodeEnv: 'development',
      });
    }).toThrow(/is not localhost\/127\.0\.0\.1/);
  });

  it('allows localhost', () => {
    expect(() => {
      assertSafeToRun({
        databaseUrl: 'postgresql://vaqt:vaqt@localhost:5432/vaqt',
        nodeEnv: 'development',
      });
    }).not.toThrow();
  });

  it('allows 127.0.0.1', () => {
    expect(() => {
      assertSafeToRun({
        databaseUrl: 'postgresql://vaqt:vaqt@127.0.0.1:5432/vaqt',
        nodeEnv: 'test',
      });
    }).not.toThrow();
  });
});

describe('findCandidates', () => {
  const userIds: string[] = [];

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  });

  it('finds a test-phone user older than the cutoff', async () => {
    const user = await createTestUser({});
    userIds.push(user.id);

    const candidates = await findCandidates(0);

    expect(candidates.some((c) => c.id === user.id)).toBe(true);
  });

  it('excludes a test-phone user created after the cutoff', async () => {
    const user = await createTestUser({});
    userIds.push(user.id);

    // A cutoff of "60 minutes ago" must not reach a row created just now.
    const candidates = await findCandidates(60);

    expect(candidates.some((c) => c.id === user.id)).toBe(false);
  });

  it('never matches a real (non test-phone) user regardless of age', async () => {
    const realPhone = `+98912${String(Date.now()).slice(-8)}`;
    const realUser = await prisma.user.create({
      data: {
        phone: realPhone,
        displayName: 'کاربر واقعی',
        phoneVerifiedAt: new Date(),
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    });

    try {
      const candidates = await findCandidates(0);
      expect(candidates.some((c) => c.id === realUser.id)).toBe(false);
    } finally {
      await prisma.user.delete({ where: { id: realUser.id } });
    }
  });

  it('aborts instead of proceeding if a seed-shaped id ever matches the test-phone prefix', async () => {
    // Structurally impossible in real seed data (see SEED_ID_PATTERN comment
    // in cleanup-qa-data.ts) — this test only proves the defense fires if it
    // ever somehow happened, rather than silently treating it as a normal
    // candidate.
    const decoy = await prisma.user.create({
      data: {
        id: `usr-decoy-${String(Date.now())}`,
        phone: randomTestPhone(),
        displayName: 'دیکوی seed-شکل',
        phoneVerifiedAt: new Date(),
      },
    });

    try {
      await expect(findCandidates(0)).rejects.toThrow(/seed-shaped id/);
    } finally {
      await prisma.user.delete({ where: { id: decoy.id } });
    }
  });
});

describe('buildCleanupPlan', () => {
  it('returns an empty plan for no candidates', async () => {
    const plan = await buildCleanupPlan([]);
    expect(plan).toEqual({
      candidates: [],
      requestIds: [],
      conversationIds: [],
      orderIds: [],
    });
  });

  it('scopes owned requests/conversations/orders to the candidates only, never a request they merely offered on', async () => {
    const realOwner = await prisma.user.create({
      data: {
        phone: `+98912${String(Date.now()).slice(-8)}`,
        displayName: 'صاحب درخواست واقعی',
        phoneVerifiedAt: new Date(),
      },
    });
    const realRequest = await prisma.request.create({
      data: {
        slug: `plan-real-${String(Date.now())}`,
        ownerId: realOwner.id,
        title: 'درخواست واقعی',
        description: 'توضیحات',
        categoryId: CATEGORY_ID,
        mode: 'ONLINE',
        durationMinutes: 60,
        budgetMinRial: 1_000_000,
        budgetMaxRial: 2_000_000,
        deadlineAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        preferredWindows: [],
        status: 'PUBLISHED',
        offerCount: 1,
      },
    });

    const candidateProvider = await createTestUser({});
    const candidateOffer = await prisma.offer.create({
      data: {
        requestId: realRequest.id,
        providerId: candidateProvider.id,
        proposedStartAt: new Date(),
        proposedDurationMinutes: 30,
        amountRial: 500_000,
      },
    });

    try {
      const candidates: CleanupCandidate[] = [
        {
          id: candidateProvider.id,
          phone: candidateProvider.phone,
          displayName: 'کاربر تست',
          createdAt: new Date(),
        },
      ];

      const plan = await buildCleanupPlan(candidates);

      // The provider is a candidate, but the request belongs to a real user
      // — only the candidate's own offer is theirs to lose, not the request.
      expect(plan.requestIds).not.toContain(realRequest.id);
      expect(plan.conversationIds).toEqual([]);
      expect(plan.orderIds).toEqual([]);
    } finally {
      await prisma.offer.delete({ where: { id: candidateOffer.id } });
      await prisma.user.delete({ where: { id: candidateProvider.id } });
      await prisma.request.delete({ where: { id: realRequest.id } });
      await prisma.user.delete({ where: { id: realOwner.id } });
    }
  });
});

describe('executeCleanupPlan', () => {
  it('deletes a candidate and everything they own, without touching a real request they merely offered on', async () => {
    const realOwner = await prisma.user.create({
      data: {
        phone: `+98912${String(Date.now()).slice(-8)}`,
        displayName: 'صاحب درخواست واقعی',
        phoneVerifiedAt: new Date(),
      },
    });
    const realRequest = await prisma.request.create({
      data: {
        slug: `exec-real-${String(Date.now())}`,
        ownerId: realOwner.id,
        title: 'درخواست واقعی',
        description: 'توضیحات',
        categoryId: CATEGORY_ID,
        mode: 'ONLINE',
        durationMinutes: 60,
        budgetMinRial: 1_000_000,
        budgetMaxRial: 2_000_000,
        deadlineAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        preferredWindows: [],
        status: 'PUBLISHED',
        offerCount: 1,
      },
    });

    const owner = await createTestUser({});
    const provider = await createTestUser({});

    // owner's own request, offered on by provider, selected -> a real
    // conversation with a system message + a text message + a review.
    const ownedRequest = await prisma.request.create({
      data: {
        slug: `exec-owned-${String(Date.now())}`,
        ownerId: owner.id,
        title: 'کار تستی',
        description: 'توضیحات تستی',
        categoryId: CATEGORY_ID,
        mode: 'ONLINE',
        durationMinutes: 45,
        budgetMinRial: 500_000,
        budgetMaxRial: 1_000_000,
        deadlineAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        preferredWindows: [],
        status: 'OFFER_SELECTED',
      },
    });
    const offer = await prisma.offer.create({
      data: {
        requestId: ownedRequest.id,
        providerId: provider.id,
        proposedStartAt: new Date(),
        proposedDurationMinutes: 45,
        amountRial: 800_000,
        status: 'SELECTED',
      },
    });
    // provider also offers directly on the real request — this offer must
    // still be swept (it belongs to the candidate) even though the request
    // itself must not be touched.
    const providerOfferOnRealRequest = await prisma.offer.create({
      data: {
        requestId: realRequest.id,
        providerId: provider.id,
        proposedStartAt: new Date(),
        proposedDurationMinutes: 20,
        amountRial: 300_000,
      },
    });
    const conversation = await prisma.conversation.create({
      data: {
        requestId: ownedRequest.id,
        offerId: offer.id,
        seekerId: owner.id,
        providerId: provider.id,
        lastMessageAt: new Date(),
      },
    });
    const systemMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: null,
        type: 'SYSTEM',
        body: 'این گفتگو به‌دلیل انتخاب پیشنهاد شما آغاز شد.',
      },
    });
    const ownerMessage = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderId: owner.id,
        type: 'TEXT',
        body: 'سلام',
      },
    });
    const review = await prisma.review.create({
      data: {
        conversationId: conversation.id,
        reviewerId: owner.id,
        revieweeId: provider.id,
        rating: 5,
      },
    });

    const urgentProduct = await prisma.product.findUniqueOrThrow({
      where: { code: 'URGENT_BADGE' },
    });
    const proMonthlyProduct = await prisma.product.findUniqueOrThrow({
      where: { code: 'PRO_MONTHLY' },
    });
    const badgeOrder = await prisma.order.create({
      data: {
        userId: owner.id,
        productId: urgentProduct.id,
        requestId: ownedRequest.id,
        amountRial: urgentProduct.priceRial,
        status: 'PAID',
        paidAt: new Date(),
      },
    });
    const entitlement = await prisma.entitlement.create({
      data: {
        userId: owner.id,
        requestId: ownedRequest.id,
        orderId: badgeOrder.id,
        type: 'URGENT_BADGE',
        startsAt: new Date(),
      },
    });
    const subOrder = await prisma.order.create({
      data: {
        userId: owner.id,
        productId: proMonthlyProduct.id,
        amountRial: proMonthlyProduct.priceRial,
        status: 'PAID',
        paidAt: new Date(),
      },
    });
    const subscription = await prisma.subscription.create({
      data: {
        userId: owner.id,
        plan: 'PRO_MONTHLY',
        orderId: subOrder.id,
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    const aiSession = await prisma.aiSession.create({
      data: {
        userId: owner.id,
        requestId: ownedRequest.id,
        messages: [],
        provider: 'mock',
      },
    });
    const session = await prisma.session.create({
      data: {
        userId: owner.id,
        familyId: `family-${owner.id}`,
        refreshTokenHash: `hash-${String(Date.now())}`,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    const auditLog = await prisma.auditLog.create({
      data: { actorId: owner.id, action: 'test.event' },
    });
    const report = await prisma.report.create({
      data: {
        reporterId: owner.id,
        targetUserId: provider.id,
        reason: 'تست',
      },
    });
    const notification = await prisma.notification.create({
      data: { userId: owner.id, type: 'test', payload: {} },
    });
    const verificationCode = await prisma.verificationCode.create({
      data: {
        phone: owner.phone,
        codeHash: 'deadbeef',
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    const candidates: CleanupCandidate[] = [owner, provider].map((u) => ({
      id: u.id,
      phone: u.phone,
      displayName: 'کاربر تست',
      createdAt: new Date(),
    }));

    const plan = await buildCleanupPlan(candidates);
    const counts = await executeCleanupPlan(plan);

    try {
      expect(counts.users).toBe(2);
      expect(counts.requests).toBe(1);
      expect(counts.offers).toBe(2);
      expect(counts.conversations).toBe(1);
      expect(counts.messages).toBe(2);
      expect(counts.reviews).toBe(1);
      expect(counts.orders).toBe(2);
      expect(counts.entitlements).toBe(1);
      expect(counts.subscriptions).toBe(1);
      expect(counts.aiSessions).toBe(1);
      expect(counts.sessions).toBe(1);
      expect(counts.auditLogs).toBe(1);
      expect(counts.reports).toBe(1);
      expect(counts.notifications).toBe(1);
      expect(counts.verificationCodes).toBe(1);

      await expect(
        prisma.user.findUnique({ where: { id: owner.id } }),
      ).resolves.toBeNull();
      await expect(
        prisma.user.findUnique({ where: { id: provider.id } }),
      ).resolves.toBeNull();
      await expect(
        prisma.request.findUnique({ where: { id: ownedRequest.id } }),
      ).resolves.toBeNull();
      await expect(
        prisma.offer.findUnique({
          where: { id: providerOfferOnRealRequest.id },
        }),
      ).resolves.toBeNull();
      await expect(
        prisma.conversation.findUnique({ where: { id: conversation.id } }),
      ).resolves.toBeNull();

      // The real request the candidate merely offered on must survive
      // completely untouched, including its cumulative offerCount.
      const survivingRealRequest = await prisma.request.findUnique({
        where: { id: realRequest.id },
      });
      expect(survivingRealRequest).not.toBeNull();
      expect(survivingRealRequest?.offerCount).toBe(1);
    } finally {
      // Everything candidate-owned is already gone; only the real,
      // untouched fixture rows remain to clean up.
      await prisma.request.delete({ where: { id: realRequest.id } });
      await prisma.user.delete({ where: { id: realOwner.id } });
    }

    // Silence unused-variable lint on rows only referenced for setup/cleanup
    // via their ids above.
    void systemMessage;
    void ownerMessage;
    void review;
    void entitlement;
    void subscription;
    void aiSession;
    void session;
    void auditLog;
    void report;
    void notification;
    void verificationCode;
  });
});

describe('cleanupRedisForPlan', () => {
  it('removes every namespaced key for each candidate and leaves unrelated keys alone', async () => {
    const redisPrefix = randomTestRedisPrefix();
    const redis = new Redis(REDIS_URL);

    const candidate: CleanupCandidate = {
      id: `cand-${String(Date.now())}`,
      phone: randomTestPhone(),
      displayName: 'کاربر تست',
      createdAt: new Date(),
    };
    const unrelatedKey = `${redisPrefix}otp:pending-code:${randomTestPhone()}`;

    try {
      await redis.set(
        `${redisPrefix}otp:pending-code:${candidate.phone}`,
        '1234',
        'PX',
        60_000,
      );
      await redis.set(
        `${redisPrefix}verified-phone:${candidate.id}`,
        '1',
        'PX',
        60_000,
      );
      await redis.set(unrelatedKey, 'untouched', 'PX', 60_000);

      const plan = {
        candidates: [candidate],
        requestIds: [],
        conversationIds: [],
        orderIds: [],
      };
      const removed = await cleanupRedisForPlan(plan, redis, redisPrefix);

      expect(removed).toBeGreaterThanOrEqual(2);
      await expect(
        redis.get(`${redisPrefix}otp:pending-code:${candidate.phone}`),
      ).resolves.toBeNull();
      await expect(
        redis.get(`${redisPrefix}verified-phone:${candidate.id}`),
      ).resolves.toBeNull();
      await expect(redis.get(unrelatedKey)).resolves.toBe('untouched');
    } finally {
      await redis.del(unrelatedKey);
      await redis.quit();
    }
  });

  it('returns 0 and touches nothing for an empty plan', async () => {
    const redis = new Redis(REDIS_URL);
    try {
      const removed = await cleanupRedisForPlan(
        { candidates: [], requestIds: [], conversationIds: [], orderIds: [] },
        redis,
        randomTestRedisPrefix(),
      );
      expect(removed).toBe(0);
    } finally {
      await redis.quit();
    }
  });
});

// `runCleanup`'s execute:true path always calls the real, global
// `findCandidates()` — there is no way to scope it to "only this test's own
// rows". Every other spec file in this suite also creates TEST_PHONE_PREFIX
// users concurrently (in other jest workers, against the same shared
// Postgres), so an `execute:true` call with `olderThanMinutes: 0` here would
// sweep up and delete *their* in-flight fixtures too — reproduced locally:
// running the full suite with such a test caused random "record not found"
// failures in unrelated spec files (offers.service.spec.ts) whenever the
// scheduler happened to run them in the same window. The actual delete+Redis
// composition this would exercise is already fully covered above via
// `executeCleanupPlan` and `cleanupRedisForPlan` with explicit, scoped
// candidate lists; only the dry-run and no-candidates paths (both read-only
// or provably empty) are safe to run here.
describe('runCleanup', () => {
  it('does not delete anything in dry-run mode', async () => {
    const user = await createTestUser({});

    try {
      const result = await runCleanup({ execute: false, olderThanMinutes: 0 });

      expect(result.executed).toBe(false);
      expect(result.counts).toBeNull();
      expect(result.plan.candidates.some((c) => c.id === user.id)).toBe(true);
      await expect(
        prisma.user.findUnique({ where: { id: user.id } }),
      ).resolves.not.toBeNull();
    } finally {
      await prisma.user.delete({ where: { id: user.id } });
    }
  });

  it('reports executed:false when execute is true but there are no candidates', async () => {
    const user = await createTestUser({});

    try {
      // A cutoff far in the past won't include a row created just now.
      const result = await runCleanup({
        execute: true,
        olderThanMinutes: 60,
      });

      expect(result.executed).toBe(false);
      expect(result.counts).toBeNull();
    } finally {
      await prisma.user.delete({ where: { id: user.id } });
    }
  });
});

afterAll(async () => {
  await prisma.category.delete({ where: { id: CATEGORY_ID } });
  await prisma.$disconnect();
});
