import {
  ConversationStatus,
  MessageType,
  OfferStatus,
  prisma,
  RequestStatus,
} from '@vaqt/db';
import { ErrorCode } from '../common/errors/error-codes';
import { OffersService } from './offers.service';

describe('OffersService (real Postgres)', () => {
  const createdOfferIds: string[] = [];
  const createdConversationIds: string[] = [];
  const createdRequestIds: string[] = [];
  const createdCategoryIds: string[] = [];
  const createdSkillIds: string[] = [];
  const createdUserIds: string[] = [];
  let service: OffersService;

  beforeEach(() => {
    service = new OffersService();
  });

  afterAll(async () => {
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

  async function makeUser(
    displayName: string,
    overrides: { bio?: string | null } = {},
  ): Promise<string> {
    const user = await prisma.user.create({
      data: {
        phone: uniquePhone(),
        displayName,
        bio: overrides.bio ?? null,
      },
    });
    createdUserIds.push(user.id);
    return user.id;
  }

  // Satisfies computeProfileCompleteness().canSubmitOffer: displayName +
  // bio + at least one skill. phoneVerifiedAt is deliberately left null —
  // submitting an offer doesn't require a verified phone (see
  // packages/shared/domain/completeness.ts), unlike publishing a request.
  async function makeCompleteProvider(
    displayName = 'ارائه‌دهنده تکمیل‌شده',
  ): Promise<string> {
    const userId = await makeUser(displayName, { bio: 'یک بیوگرافی کامل.' });
    const skill = await prisma.skill.create({
      data: {
        name: 'مهارت تست پیشنهاد',
        slug: `test-skill-offer-${String(Date.now())}-${String(Math.random())}`,
      },
    });
    createdSkillIds.push(skill.id);
    await prisma.userSkill.create({
      data: { userId, skillId: skill.id },
    });
    return userId;
  }

  async function makeCategory(): Promise<string> {
    const category = await prisma.category.create({
      data: {
        name: 'دسته تست فاز ۶',
        slug: `test-cat-offer-${String(Date.now())}-${String(Math.random())}`,
      },
    });
    createdCategoryIds.push(category.id);
    return category.id;
  }

  async function makeRequest(
    ownerId: string,
    overrides: { status?: RequestStatus } = {},
  ): Promise<string> {
    const categoryId = await makeCategory();
    const status = overrides.status ?? RequestStatus.PUBLISHED;
    const request = await prisma.request.create({
      data: {
        slug: `req-offer-test-${String(Date.now())}-${String(Math.random())}`,
        ownerId,
        title: 'کمک برای تست پیشنهاد',
        description: 'توضیحات تستی برای بررسی جریان پیشنهادها.',
        categoryId,
        mode: 'ONLINE',
        durationMinutes: 60,
        budgetMinRial: 1_000_000,
        budgetMaxRial: 2_000_000,
        deadlineAt: new Date(Date.now() + 86_400_000),
        preferredWindows: [],
        status,
        publishedAt: status === RequestStatus.PUBLISHED ? new Date() : null,
      },
    });
    createdRequestIds.push(request.id);
    return request.id;
  }

  function validSubmitInput(
    requestId: string,
    overrides: Record<string, unknown> = {},
  ) {
    return {
      requestId,
      proposedStartAt: new Date(Date.now() + 3 * 86_400_000),
      proposedDurationMinutes: 60,
      amountRial: 1_500_000,
      message: null,
      ...overrides,
    };
  }

  describe('submit()', () => {
    it('creates a PENDING offer and increments the request offerCount', async () => {
      const ownerId = await makeUser('صاحب درخواست');
      const requestId = await makeRequest(ownerId);
      const providerId = await makeCompleteProvider();

      const offer = await service.submit(
        providerId,
        validSubmitInput(requestId),
      );
      createdOfferIds.push(offer.id);

      expect(offer.status).toBe(OfferStatus.PENDING);
      expect(offer.revisionCount).toBe(0);

      const row = await prisma.request.findUniqueOrThrow({
        where: { id: requestId },
      });
      expect(row.offerCount).toBe(1);
    });

    it('rejects a request that does not exist', async () => {
      const providerId = await makeCompleteProvider();
      await expect(
        service.submit(providerId, validSubmitInput('does-not-exist')),
      ).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
    });

    it('rejects submitting on a request that is not PUBLISHED', async () => {
      const ownerId = await makeUser('صاحب درخواست پیش‌نویس');
      const requestId = await makeRequest(ownerId, {
        status: RequestStatus.DRAFT,
      });
      const providerId = await makeCompleteProvider();

      await expect(
        service.submit(providerId, validSubmitInput(requestId)),
      ).rejects.toMatchObject({ code: ErrorCode.REQUEST_NOT_PUBLISHED });
    });

    it('rejects the request owner offering on their own request', async () => {
      const ownerId = await makeCompleteProvider('صاحب و ارائه‌دهنده یکسان');
      const requestId = await makeRequest(ownerId);

      await expect(
        service.submit(ownerId, validSubmitInput(requestId)),
      ).rejects.toMatchObject({
        code: ErrorCode.OWN_REQUEST_OFFER_FORBIDDEN,
      });
    });

    it('rejects a provider with an incomplete profile (no bio, no skills)', async () => {
      const ownerId = await makeUser('صاحب درخواست ۲');
      const requestId = await makeRequest(ownerId);
      const incompleteProviderId = await makeUser('ارائه‌دهنده ناقص');

      await expect(
        service.submit(incompleteProviderId, validSubmitInput(requestId)),
      ).rejects.toMatchObject({
        code: ErrorCode.PROFILE_INCOMPLETE_FOR_OFFER,
      });
    });

    it('rejects a second active offer from the same provider on the same request', async () => {
      const ownerId = await makeUser('صاحب درخواست ۳');
      const requestId = await makeRequest(ownerId);
      const providerId = await makeCompleteProvider();

      const first = await service.submit(
        providerId,
        validSubmitInput(requestId),
      );
      createdOfferIds.push(first.id);

      await expect(
        service.submit(providerId, validSubmitInput(requestId)),
      ).rejects.toMatchObject({ code: ErrorCode.OFFER_ALREADY_EXISTS });
    });

    it('reactivates a WITHDRAWN offer on re-submit instead of creating a new row, and does not double-count offerCount', async () => {
      const ownerId = await makeUser('صاحب درخواست ۴');
      const requestId = await makeRequest(ownerId);
      const providerId = await makeCompleteProvider();

      const first = await service.submit(
        providerId,
        validSubmitInput(requestId),
      );
      createdOfferIds.push(first.id);
      await service.withdraw(first.id);

      const resubmitted = await service.submit(
        providerId,
        validSubmitInput(requestId, { amountRial: 2_000_000 }),
      );

      expect(resubmitted.id).toBe(first.id);
      expect(resubmitted.status).toBe(OfferStatus.PENDING);
      expect(resubmitted.revisionCount).toBe(1);

      const row = await prisma.request.findUniqueOrThrow({
        where: { id: requestId },
      });
      expect(row.offerCount).toBe(1);
    });
  });

  describe('withdraw()', () => {
    it('transitions a PENDING offer to WITHDRAWN', async () => {
      const ownerId = await makeUser('صاحب درخواست ۵');
      const requestId = await makeRequest(ownerId);
      const providerId = await makeCompleteProvider();
      const offer = await service.submit(
        providerId,
        validSubmitInput(requestId),
      );
      createdOfferIds.push(offer.id);

      const withdrawn = await service.withdraw(offer.id);
      expect(withdrawn.status).toBe(OfferStatus.WITHDRAWN);
    });

    it('rejects withdrawing an offer that is not PENDING', async () => {
      const ownerId = await makeUser('صاحب درخواست ۶');
      const requestId = await makeRequest(ownerId);
      const providerId = await makeCompleteProvider();
      const offer = await service.submit(
        providerId,
        validSubmitInput(requestId),
      );
      createdOfferIds.push(offer.id);
      await service.withdraw(offer.id);

      await expect(service.withdraw(offer.id)).rejects.toMatchObject({
        code: ErrorCode.OFFER_NOT_PENDING,
      });
    });

    it('rejects an offer that does not exist', async () => {
      await expect(service.withdraw('does-not-exist')).rejects.toMatchObject({
        code: ErrorCode.NOT_FOUND,
      });
    });
  });

  describe('select()', () => {
    it('selects a PENDING offer, moves the request to OFFER_SELECTED, and opens a Conversation with a SYSTEM message', async () => {
      const ownerId = await makeUser('صاحب درخواست ۷');
      const requestId = await makeRequest(ownerId);
      const providerId = await makeCompleteProvider();
      const offer = await service.submit(
        providerId,
        validSubmitInput(requestId),
      );
      createdOfferIds.push(offer.id);

      const result = await service.select(offer.id);
      createdConversationIds.push(result.conversationId);

      expect(result.offerId).toBe(offer.id);
      expect(result.requestId).toBe(requestId);

      const updatedOffer = await prisma.offer.findUniqueOrThrow({
        where: { id: offer.id },
      });
      expect(updatedOffer.status).toBe(OfferStatus.SELECTED);

      const updatedRequest = await prisma.request.findUniqueOrThrow({
        where: { id: requestId },
      });
      expect(updatedRequest.status).toBe(RequestStatus.OFFER_SELECTED);

      const conversation = await prisma.conversation.findUniqueOrThrow({
        where: { id: result.conversationId },
      });
      expect(conversation.seekerId).toBe(ownerId);
      expect(conversation.providerId).toBe(providerId);
      expect(conversation.status).toBe(ConversationStatus.OPEN);

      const messages = await prisma.message.findMany({
        where: { conversationId: result.conversationId },
      });
      expect(messages).toHaveLength(1);
      expect(messages[0]?.type).toBe(MessageType.SYSTEM);
      expect(messages[0]?.senderId).toBeNull();
    });

    it('rejects other PENDING offers on the same request when one is selected', async () => {
      const ownerId = await makeUser('صاحب درخواست ۸');
      const requestId = await makeRequest(ownerId);
      const providerA = await makeCompleteProvider('ارائه‌دهنده الف');
      const providerB = await makeCompleteProvider('ارائه‌دهنده ب');

      const offerA = await service.submit(
        providerA,
        validSubmitInput(requestId),
      );
      createdOfferIds.push(offerA.id);
      const offerB = await service.submit(
        providerB,
        validSubmitInput(requestId),
      );
      createdOfferIds.push(offerB.id);

      const result = await service.select(offerA.id);
      createdConversationIds.push(result.conversationId);

      const rejectedOffer = await prisma.offer.findUniqueOrThrow({
        where: { id: offerB.id },
      });
      expect(rejectedOffer.status).toBe(OfferStatus.REJECTED);
    });

    it('rejects selecting an offer that is not PENDING', async () => {
      const ownerId = await makeUser('صاحب درخواست ۹');
      const requestId = await makeRequest(ownerId);
      const providerId = await makeCompleteProvider();
      const offer = await service.submit(
        providerId,
        validSubmitInput(requestId),
      );
      createdOfferIds.push(offer.id);
      await service.withdraw(offer.id);

      await expect(service.select(offer.id)).rejects.toMatchObject({
        code: ErrorCode.OFFER_NOT_PENDING,
      });
    });

    it('rejects selecting a second offer once the request already moved past PUBLISHED', async () => {
      const ownerId = await makeUser('صاحب درخواست ۱۰');
      const requestId = await makeRequest(ownerId);
      const providerA = await makeCompleteProvider('ارائه‌دهنده ج');
      const providerB = await makeCompleteProvider('ارائه‌دهنده د');

      const offerA = await service.submit(
        providerA,
        validSubmitInput(requestId),
      );
      createdOfferIds.push(offerA.id);
      const offerB = await service.submit(
        providerB,
        validSubmitInput(requestId),
      );
      createdOfferIds.push(offerB.id);

      const result = await service.select(offerA.id);
      createdConversationIds.push(result.conversationId);

      // offerB was already auto-rejected by selecting offerA, so re-force it
      // back to PENDING to isolate the request-status check from the
      // offer-status check covered by the previous test.
      await prisma.offer.update({
        where: { id: offerB.id },
        data: { status: OfferStatus.PENDING },
      });

      await expect(service.select(offerB.id)).rejects.toMatchObject({
        code: ErrorCode.REQUEST_NOT_PUBLISHED,
      });
    });

    it('rejects an offer that does not exist', async () => {
      await expect(service.select('does-not-exist')).rejects.toMatchObject({
        code: ErrorCode.NOT_FOUND,
      });
    });
  });

  describe('listForRequest()', () => {
    it('returns offers for a request ordered by newest first, with providerDisplayName resolved', async () => {
      const ownerId = await makeUser('صاحب درخواست ۱۱');
      const requestId = await makeRequest(ownerId);
      const providerA = await makeCompleteProvider('اولین ارائه‌دهنده');
      const providerB = await makeCompleteProvider('دومین ارائه‌دهنده');

      const offerA = await service.submit(
        providerA,
        validSubmitInput(requestId),
      );
      createdOfferIds.push(offerA.id);
      const offerB = await service.submit(
        providerB,
        validSubmitInput(requestId),
      );
      createdOfferIds.push(offerB.id);

      const list = await service.listForRequest(requestId);
      expect(list.map((o) => o.id)).toEqual([offerB.id, offerA.id]);
      expect(list.find((o) => o.id === offerA.id)?.providerDisplayName).toBe(
        'اولین ارائه‌دهنده',
      );
    });
  });

  describe('listMine()', () => {
    it('returns only the current provider’s own offers across different requests', async () => {
      const ownerId = await makeUser('صاحب درخواست ۱۲');
      const requestOne = await makeRequest(ownerId);
      const requestTwo = await makeRequest(ownerId);
      const mine = await makeCompleteProvider('من');
      const someoneElse = await makeCompleteProvider('دیگری');

      const myOffer = await service.submit(mine, validSubmitInput(requestOne));
      createdOfferIds.push(myOffer.id);
      const otherOffer = await service.submit(
        someoneElse,
        validSubmitInput(requestTwo),
      );
      createdOfferIds.push(otherOffer.id);

      const mineList = await service.listMine(mine);
      expect(mineList.map((o) => o.id)).toEqual([myOffer.id]);
      expect(mineList.find((o) => o.id === otherOffer.id)).toBeUndefined();
    });
  });
});
