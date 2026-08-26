import { prisma, RequestStatus } from '@vaqt/db';
import { ErrorCode } from '../common/errors/error-codes';
import { OffersService } from '../offers/offers.service';
import { ReviewsService } from './reviews.service';

// Conversations only ever come into existence through OffersService.select()
// in this codebase, so these tests build real conversations through that
// real flow — same reasoning as conversations.service.spec.ts.
describe('ReviewsService (real Postgres)', () => {
  const createdReviewIds: string[] = [];
  const createdConversationIds: string[] = [];
  const createdOfferIds: string[] = [];
  const createdRequestIds: string[] = [];
  const createdCategoryIds: string[] = [];
  const createdSkillIds: string[] = [];
  const createdUserIds: string[] = [];
  let reviews: ReviewsService;
  let offers: OffersService;

  beforeEach(() => {
    reviews = new ReviewsService();
    offers = new OffersService();
  });

  afterAll(async () => {
    for (const id of createdReviewIds.splice(0)) {
      await prisma.review.deleteMany({ where: { id } });
    }
    for (const id of createdConversationIds.splice(0)) {
      await prisma.message.deleteMany({ where: { conversationId: id } });
      await prisma.conversation.deleteMany({ where: { id } });
    }
    for (const id of createdOfferIds.splice(0)) {
      await prisma.offer.deleteMany({ where: { id } });
    }
    for (const id of createdRequestIds.splice(0)) {
      await prisma.request.deleteMany({ where: { id } });
    }
    for (const id of createdSkillIds.splice(0)) {
      await prisma.userSkill.deleteMany({ where: { skillId: id } });
      await prisma.skill.deleteMany({ where: { id } });
    }
    for (const id of createdCategoryIds.splice(0)) {
      await prisma.category.deleteMany({ where: { id } });
    }
    for (const id of createdUserIds.splice(0)) {
      await prisma.user.deleteMany({ where: { id } });
    }
    await prisma.$disconnect();
  });

  function uniquePhone(): string {
    return `+9899${String(Date.now()).slice(-4)}${String(
      Math.floor(Math.random() * 10000),
    ).padStart(4, '0')}`;
  }

  async function makeUser(displayName: string): Promise<string> {
    const user = await prisma.user.create({
      data: { phone: uniquePhone(), displayName, bio: null },
    });
    createdUserIds.push(user.id);
    return user.id;
  }

  async function makeCompleteProvider(
    displayName = 'ارائه‌دهنده تکمیل‌شده',
  ): Promise<string> {
    const userId = await makeUser(displayName);
    await prisma.user.update({
      where: { id: userId },
      data: { bio: 'یک بیوگرافی کامل.' },
    });
    const skill = await prisma.skill.create({
      data: {
        name: 'مهارت تست نظرات',
        slug: `test-skill-review-${String(Date.now())}-${String(Math.random())}`,
      },
    });
    createdSkillIds.push(skill.id);
    await prisma.userSkill.create({ data: { userId, skillId: skill.id } });
    return userId;
  }

  async function makeRequest(
    ownerId: string,
    title = 'کمک برای تست نظرات',
  ): Promise<string> {
    const category = await prisma.category.create({
      data: {
        name: 'دسته تست فاز ۱۰',
        slug: `test-cat-review-${String(Date.now())}-${String(Math.random())}`,
      },
    });
    createdCategoryIds.push(category.id);
    const request = await prisma.request.create({
      data: {
        slug: `req-review-test-${String(Date.now())}-${String(Math.random())}`,
        ownerId,
        title,
        description: 'توضیحات تستی برای بررسی نظرات.',
        categoryId: category.id,
        mode: 'ONLINE',
        durationMinutes: 60,
        budgetMinRial: 1_000_000,
        budgetMaxRial: 2_000_000,
        deadlineAt: new Date(Date.now() + 86_400_000),
        preferredWindows: [],
        status: RequestStatus.PUBLISHED,
        publishedAt: new Date(),
      },
    });
    createdRequestIds.push(request.id);
    return request.id;
  }

  // Builds a real, open conversation via submit() -> select(), returning
  // the seeker/provider ids and the conversation id.
  async function makeConversation(
    providerId?: string,
  ): Promise<{ seekerId: string; providerId: string; conversationId: string }> {
    const seekerId = await makeUser('درخواست‌دهنده تست نظرات');
    const requestId = await makeRequest(seekerId);
    const resolvedProviderId = providerId ?? (await makeCompleteProvider());
    const offer = await offers.submit(resolvedProviderId, {
      requestId,
      proposedStartAt: new Date(Date.now() + 3 * 86_400_000),
      proposedDurationMinutes: 60,
      amountRial: 1_500_000,
      message: null,
    });
    createdOfferIds.push(offer.id);
    const selected = await offers.select(offer.id);
    createdConversationIds.push(selected.conversationId);
    return {
      seekerId,
      providerId: resolvedProviderId,
      conversationId: selected.conversationId,
    };
  }

  describe('submit()', () => {
    it('creates a review from the seeker and sets the provider rating to it', async () => {
      const { seekerId, providerId, conversationId } = await makeConversation();

      const review = await reviews.submit(
        conversationId,
        seekerId,
        5,
        'همکاری عالی بود.',
      );
      createdReviewIds.push(review.id);

      expect(review.rating).toBe(5);
      expect(review.comment).toBe('همکاری عالی بود.');
      expect(review.reviewer.id).toBe(seekerId);

      const provider = await prisma.user.findUniqueOrThrow({
        where: { id: providerId },
      });
      expect(provider.ratingAvg).toBe(5);
      expect(provider.ratingCount).toBe(1);
    });

    it('derives the reviewee as the other participant when the provider reviews the seeker', async () => {
      const { seekerId, providerId, conversationId } = await makeConversation();

      const review = await reviews.submit(conversationId, providerId, 4);
      createdReviewIds.push(review.id);

      const seeker = await prisma.user.findUniqueOrThrow({
        where: { id: seekerId },
      });
      expect(seeker.ratingAvg).toBe(4);
      expect(seeker.ratingCount).toBe(1);

      // The provider's own rating is untouched by a review they gave.
      const provider = await prisma.user.findUniqueOrThrow({
        where: { id: providerId },
      });
      expect(provider.ratingCount).toBe(0);
    });

    it('averages across multiple conversations for the same reviewee', async () => {
      const provider = await makeCompleteProvider('ارائه‌دهنده با چند نظر');
      const first = await makeConversation(provider);
      const second = await makeConversation(provider);

      const r1 = await reviews.submit(first.conversationId, first.seekerId, 3);
      createdReviewIds.push(r1.id);
      const r2 = await reviews.submit(
        second.conversationId,
        second.seekerId,
        5,
      );
      createdReviewIds.push(r2.id);

      const updated = await prisma.user.findUniqueOrThrow({
        where: { id: provider },
      });
      expect(updated.ratingAvg).toBe(4);
      expect(updated.ratingCount).toBe(2);
    });

    it('rejects a second review from the same reviewer for the same conversation', async () => {
      const { seekerId, conversationId } = await makeConversation();
      const first = await reviews.submit(conversationId, seekerId, 5);
      createdReviewIds.push(first.id);

      await expect(
        reviews.submit(conversationId, seekerId, 1),
      ).rejects.toMatchObject({ code: ErrorCode.REVIEW_ALREADY_EXISTS });
    });

    it('rejects a conversation that does not exist', async () => {
      await expect(
        reviews.submit('does-not-exist', 'irrelevant', 5),
      ).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
    });
  });

  describe('listForUser()', () => {
    it('returns reviews for the reviewee, newest first, with reviewer info', async () => {
      const provider = await makeCompleteProvider('ارائه‌دهنده لیست نظرات');
      const first = await makeConversation(provider);
      const second = await makeConversation(provider);

      const r1 = await reviews.submit(
        first.conversationId,
        first.seekerId,
        3,
        'نظر اول',
      );
      createdReviewIds.push(r1.id);
      const r2 = await reviews.submit(
        second.conversationId,
        second.seekerId,
        5,
        'نظر دوم',
      );
      createdReviewIds.push(r2.id);

      const page = await reviews.listForUser(provider, null, 20);
      expect(page.items.map((r) => r.id)).toEqual([r2.id, r1.id]);
      expect(page.items[0]?.reviewer.id).toBe(second.seekerId);
      expect(page.hasMore).toBe(false);
    });

    it('paginates with a cursor', async () => {
      const provider = await makeCompleteProvider('ارائه‌دهنده صفحه‌بندی');
      const conversationsAndReviews: string[] = [];
      for (let i = 0; i < 3; i++) {
        const conv = await makeConversation(provider);
        const review = await reviews.submit(
          conv.conversationId,
          conv.seekerId,
          3,
        );
        createdReviewIds.push(review.id);
        conversationsAndReviews.push(review.id);
      }
      const [oldestId, middleId, newestId] = conversationsAndReviews;

      const firstPage = await reviews.listForUser(provider, null, 2);
      expect(firstPage.items.map((r) => r.id)).toEqual([newestId, middleId]);
      expect(firstPage.hasMore).toBe(true);
      expect(firstPage.nextCursor).not.toBeNull();

      const secondPage = await reviews.listForUser(
        provider,
        firstPage.nextCursor,
        2,
      );
      expect(secondPage.items.map((r) => r.id)).toEqual([oldestId]);
      expect(secondPage.hasMore).toBe(false);
    });

    it('excludes reviews marked not visible', async () => {
      const { seekerId, providerId, conversationId } = await makeConversation();
      const review = await reviews.submit(conversationId, seekerId, 2);
      createdReviewIds.push(review.id);
      await prisma.review.update({
        where: { id: review.id },
        data: { isVisible: false },
      });

      const page = await reviews.listForUser(providerId, null, 20);
      expect(page.items).toHaveLength(0);
    });
  });

  describe('myReviewStatus()', () => {
    it('reports not reviewed before submitting, then reviewed with what was rated', async () => {
      const { seekerId, conversationId } = await makeConversation();

      await expect(
        reviews.myReviewStatus(conversationId, seekerId),
      ).resolves.toEqual({ reviewed: false, rating: null, comment: null });

      const review = await reviews.submit(
        conversationId,
        seekerId,
        5,
        'عالی بود',
      );
      createdReviewIds.push(review.id);

      await expect(
        reviews.myReviewStatus(conversationId, seekerId),
      ).resolves.toEqual({
        reviewed: true,
        rating: 5,
        comment: 'عالی بود',
      });
    });
  });
});
