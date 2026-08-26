import { MessageType, prisma, RequestStatus } from '@vaqt/db';
import { ErrorCode } from '../common/errors/error-codes';
import { OffersService } from '../offers/offers.service';
import { ConversationsService } from './conversations.service';

// Conversations only ever come into existence through OffersService.select()
// in this codebase (there is no direct "create conversation" endpoint), so
// these tests build a real conversation through that real flow rather than
// inserting one directly — the same way offers.service.spec.ts exercises
// the actual submit()/select() path instead of hand-crafting rows.
describe('ConversationsService (real Postgres)', () => {
  const createdConversationIds: string[] = [];
  const createdOfferIds: string[] = [];
  const createdRequestIds: string[] = [];
  const createdCategoryIds: string[] = [];
  const createdSkillIds: string[] = [];
  const createdUserIds: string[] = [];
  let conversations: ConversationsService;
  let offers: OffersService;

  beforeEach(() => {
    conversations = new ConversationsService();
    offers = new OffersService();
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
        name: 'مهارت تست گفتگو',
        slug: `test-skill-conv-${String(Date.now())}-${String(Math.random())}`,
      },
    });
    createdSkillIds.push(skill.id);
    await prisma.userSkill.create({ data: { userId, skillId: skill.id } });
    return userId;
  }

  async function makeRequest(
    ownerId: string,
    title = 'کمک برای تست گفتگو',
  ): Promise<string> {
    const category = await prisma.category.create({
      data: {
        name: 'دسته تست فاز ۸',
        slug: `test-cat-conv-${String(Date.now())}-${String(Math.random())}`,
      },
    });
    createdCategoryIds.push(category.id);
    const request = await prisma.request.create({
      data: {
        slug: `req-conv-test-${String(Date.now())}-${String(Math.random())}`,
        ownerId,
        title,
        description: 'توضیحات تستی برای بررسی گفتگو.',
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
  async function makeOpenConversation(
    requestTitle?: string,
  ): Promise<{ seekerId: string; providerId: string; conversationId: string }> {
    const seekerId = await makeUser('درخواست‌دهنده تست گفتگو');
    const requestId = await makeRequest(seekerId, requestTitle);
    const providerId = await makeCompleteProvider();
    const offer = await offers.submit(providerId, {
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
      providerId,
      conversationId: selected.conversationId,
    };
  }

  describe('getById()', () => {
    it('returns the conversation with the counterpart resolved for each side', async () => {
      const { seekerId, providerId, conversationId } =
        await makeOpenConversation('عنوان تست گفتگو الف');

      const asSeeker = await conversations.getById(conversationId, seekerId);
      expect(asSeeker.status).toBe('OPEN');
      expect(asSeeker.requestTitle).toBe('عنوان تست گفتگو الف');
      expect(asSeeker.counterpartDisplayName).toBe('ارائه‌دهنده تکمیل‌شده');
      expect(asSeeker.counterpartId).toBe(providerId);

      const asProvider = await conversations.getById(
        conversationId,
        providerId,
      );
      expect(asProvider.counterpartDisplayName).toBe('درخواست‌دهنده تست گفتگو');
      expect(asProvider.counterpartId).toBe(seekerId);
    });

    it('rejects a conversation that does not exist', async () => {
      await expect(
        conversations.getById('does-not-exist', 'irrelevant'),
      ).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
    });
  });

  describe('listMine()', () => {
    it('returns only conversations the user participates in, newest last-message first', async () => {
      const first = await makeOpenConversation('اولین گفتگو');
      const second = await makeOpenConversation('دومین گفتگو');
      // Bump the first conversation's lastMessageAt ahead of the second so
      // ordering is unambiguous regardless of how close their creation
      // timestamps land.
      await conversations.sendMessage(
        first.conversationId,
        first.seekerId,
        'یک پیام برای بالا آمدن این گفتگو',
      );

      const mine = await conversations.listMine(first.seekerId);
      expect(mine[0]?.id).toBe(first.conversationId);
      expect(mine.some((c) => c.id === second.conversationId)).toBe(false);
    });

    it('includes the last message preview', async () => {
      const { seekerId, conversationId } = await makeOpenConversation();
      await conversations.sendMessage(conversationId, seekerId, 'سلام!');

      const mine = await conversations.listMine(seekerId);
      const row = mine.find((c) => c.id === conversationId);
      expect(row?.lastMessagePreview).toBe('سلام!');
    });
  });

  describe('sendMessage()', () => {
    it('creates a TEXT message from the sender and bumps lastMessageAt', async () => {
      const { seekerId, conversationId } = await makeOpenConversation();

      const message = await conversations.sendMessage(
        conversationId,
        seekerId,
        'وقت شما بخیر.',
      );
      expect(message.type).toBe(MessageType.TEXT);
      expect(message.senderId).toBe(seekerId);
      expect(message.isMine).toBe(true);

      const row = await prisma.conversation.findUniqueOrThrow({
        where: { id: conversationId },
      });
      expect(row.lastMessageAt).not.toBeNull();
    });

    it('rejects a conversation that does not exist', async () => {
      await expect(
        conversations.sendMessage('does-not-exist', 'irrelevant', 'سلام'),
      ).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
    });

    it('rejects sending into an ARCHIVED conversation', async () => {
      const { seekerId, conversationId } = await makeOpenConversation();
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { status: 'ARCHIVED' },
      });

      await expect(
        conversations.sendMessage(conversationId, seekerId, 'سلام'),
      ).rejects.toMatchObject({ code: ErrorCode.CONVERSATION_ARCHIVED });
    });
  });

  describe('listMessages()', () => {
    it('returns messages newest-first and paginates with a cursor', async () => {
      const { seekerId, providerId, conversationId } =
        await makeOpenConversation();
      // makeOpenConversation already leaves one SYSTEM message; add three
      // more TEXT messages so there are four total.
      await conversations.sendMessage(conversationId, seekerId, 'پیام یک');
      await conversations.sendMessage(conversationId, providerId, 'پیام دو');
      await conversations.sendMessage(conversationId, seekerId, 'پیام سه');

      const firstPage = await conversations.listMessages(
        conversationId,
        seekerId,
        null,
        2,
      );
      expect(firstPage.items).toHaveLength(2);
      expect(firstPage.hasMore).toBe(true);
      expect(firstPage.items[0]?.body).toBe('پیام سه');
      expect(firstPage.nextCursor).not.toBeNull();

      const secondPage = await conversations.listMessages(
        conversationId,
        seekerId,
        firstPage.nextCursor,
        2,
      );
      expect(secondPage.items).toHaveLength(2);
      expect(secondPage.hasMore).toBe(false);
      expect(secondPage.items[1]?.type).toBe(MessageType.SYSTEM);
    });

    it('marks the counterpart’s unread messages as read when the viewer fetches them', async () => {
      const { seekerId, providerId, conversationId } =
        await makeOpenConversation();
      const sent = await conversations.sendMessage(
        conversationId,
        providerId,
        'پیامی از ارائه‌دهنده',
      );
      expect(sent.readAt).toBeNull();

      await conversations.listMessages(conversationId, seekerId, null, 10);

      const row = await prisma.message.findUniqueOrThrow({
        where: { id: sent.id },
      });
      expect(row.readAt).not.toBeNull();
    });

    it('does not mark the viewer’s own messages as read via readAt (no self-read-receipt)', async () => {
      const { seekerId, conversationId } = await makeOpenConversation();
      const sent = await conversations.sendMessage(
        conversationId,
        seekerId,
        'پیام خودم',
      );

      await conversations.listMessages(conversationId, seekerId, null, 10);

      const row = await prisma.message.findUniqueOrThrow({
        where: { id: sent.id },
      });
      expect(row.readAt).toBeNull();
    });
  });
});
