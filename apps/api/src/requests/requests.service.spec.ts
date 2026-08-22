import { prisma, RequestStatus } from '@vaqt/db';
import { AppError } from '../common/errors/app-error';
import { ErrorCode } from '../common/errors/error-codes';
import { RequestsService } from './requests.service';

describe('RequestsService (real Postgres)', () => {
  const createdRequestIds: string[] = [];
  const createdCategoryIds: string[] = [];
  const createdUserIds: string[] = [];
  let service: RequestsService;

  beforeEach(() => {
    service = new RequestsService();
  });

  afterAll(async () => {
    for (const id of createdRequestIds.splice(0)) {
      await prisma.request.deleteMany({ where: { id } });
    }
    for (const id of createdCategoryIds.splice(0)) {
      await prisma.category.deleteMany({ where: { id } });
    }
    for (const id of createdUserIds.splice(0)) {
      await prisma.user.deleteMany({ where: { id } });
    }
    await prisma.$disconnect();
  });

  async function makeCategory(
    overrides: { isActive?: boolean } = {},
  ): Promise<string> {
    const category = await prisma.category.create({
      data: {
        name: 'دسته تست فاز ۵',
        slug: `test-cat-req-${String(Date.now())}-${String(Math.random())}`,
        isActive: overrides.isActive ?? true,
      },
    });
    createdCategoryIds.push(category.id);
    return category.id;
  }

  async function makeUser(displayName = 'صاحب درخواست'): Promise<string> {
    const user = await prisma.user.create({
      data: {
        phone: `+9899${String(Date.now()).slice(-4)}${String(
          Math.floor(Math.random() * 10000),
        ).padStart(4, '0')}`,
        displayName,
      },
    });
    createdUserIds.push(user.id);
    return user.id;
  }

  function validCreateInput(
    categoryId: string,
    overrides: Record<string, unknown> = {},
  ) {
    return {
      title: 'کمک برای آماده‌سازی مصاحبه فنی',
      description: 'به یک مصاحبه‌ی شبیه‌سازی‌شده برای موقعیت بک‌اند نیاز دارم.',
      categoryId,
      mode: 'ONLINE' as const,
      city: null,
      durationMinutes: 60,
      budgetMinRial: 1_000_000,
      budgetMaxRial: 2_000_000,
      deadlineAt: new Date(Date.now() + 86_400_000),
      preferredWindows: [],
      ...overrides,
    };
  }

  describe('create()', () => {
    it('creates a DRAFT request and populates searchText from normalizeFa(title + description)', async () => {
      const categoryId = await makeCategory();
      const ownerId = await makeUser();

      const created = await service.create(
        ownerId,
        validCreateInput(categoryId),
      );
      createdRequestIds.push(created.id);

      expect(created.status).toBe(RequestStatus.DRAFT);

      const row = await prisma.request.findUniqueOrThrow({
        where: { id: created.id },
      });
      expect(row.searchText.length).toBeGreaterThan(0);
      expect(row.searchText).toContain('مصاحبه');
    });

    it('rejects a category that does not exist', async () => {
      const ownerId = await makeUser();

      await expect(
        service.create(ownerId, validCreateInput('nope')),
      ).rejects.toThrow(AppError);
    });

    it('rejects an inactive category', async () => {
      const categoryId = await makeCategory({ isActive: false });
      const ownerId = await makeUser();

      await expect(
        service.create(ownerId, validCreateInput(categoryId)),
      ).rejects.toThrow(AppError);
    });
  });

  describe('publish()', () => {
    it('transitions a DRAFT to PUBLISHED and explicitly sets listTier and listRankAt to publishedAt', async () => {
      const categoryId = await makeCategory();
      const ownerId = await makeUser();
      const created = await service.create(
        ownerId,
        validCreateInput(categoryId),
      );
      createdRequestIds.push(created.id);

      const published = await service.publish(created.id);

      expect(published.status).toBe(RequestStatus.PUBLISHED);
      expect(published.publishedAt).not.toBeNull();

      const row = await prisma.request.findUniqueOrThrow({
        where: { id: created.id },
      });
      expect(row.listTier).toBe(0);
      expect(row.listRankAt.getTime()).toBe(row.publishedAt?.getTime());
    });

    it('rejects publishing a request that is not DRAFT, with a Persian error message', async () => {
      const categoryId = await makeCategory();
      const ownerId = await makeUser();
      const created = await service.create(
        ownerId,
        validCreateInput(categoryId),
      );
      createdRequestIds.push(created.id);
      await service.publish(created.id);

      await expect(service.publish(created.id)).rejects.toMatchObject({
        code: ErrorCode.REQUEST_NOT_DRAFT,
      });

      try {
        await service.publish(created.id);
        throw new Error('expected publish() to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        const response = (err as AppError).getResponse() as {
          message: string;
        };
        expect(response.message).toBe(
          'فقط درخواست‌های پیش‌نویس را می‌توان منتشر کرد.',
        );
      }
    });

    it('rejects publishing a request that does not exist', async () => {
      await expect(service.publish('does-not-exist')).rejects.toMatchObject({
        code: ErrorCode.NOT_FOUND,
      });
    });
  });

  describe('list()', () => {
    it('never includes any digit of the budget anywhere in the response JSON (negative string test, not a null check)', async () => {
      const categoryId = await makeCategory();
      const ownerId = await makeUser();
      const created = await service.create(
        ownerId,
        validCreateInput(categoryId, {
          budgetMinRial: 4_990_000,
          budgetMaxRial: 7_770_000,
        }),
      );
      createdRequestIds.push(created.id);
      await service.publish(created.id);

      const result = await service.list({ limit: 50 });
      const json = JSON.stringify(result);

      expect(json).toContain(created.id);
      expect(json).not.toMatch(/4990000|7770000|4,990,000|7,770,000/);
    });

    it('paginates correctly across rows that share the same (listTier, listRankAt) — no row skipped, none repeated', async () => {
      const categoryId = await makeCategory();
      const ownerId = await makeUser();
      const tiedAt = new Date();

      const ids: string[] = [];
      for (let i = 0; i < 5; i++) {
        const created = await service.create(
          ownerId,
          validCreateInput(categoryId, {
            title: `درخواست هم‌رتبه شماره ${String(i)}`,
          }),
        );
        createdRequestIds.push(created.id);
        // Publish normally, then force every row to the exact same
        // (listTier, listRankAt) tuple to actually exercise the tie-break
        // — service.publish() alone would give each row a distinct
        // timestamp, defeating the point of this test.
        await service.publish(created.id);
        await prisma.request.update({
          where: { id: created.id },
          data: { listTier: 0, listRankAt: tiedAt },
        });
        ids.push(created.id);
      }

      const collected: string[] = [];
      let cursor: string | null = null;
      let guard = 0;
      do {
        const page = await service.list({ limit: 2, cursor });
        collected.push(...page.items.map((i) => i.id));
        cursor = page.nextCursor;
        guard++;
      } while (cursor !== null && guard < 10);

      const collectedTied = collected.filter((id) => ids.includes(id));
      // Every tied id appears — nothing skipped.
      expect(new Set(collectedTied)).toEqual(new Set(ids));
      // Nothing appears twice — nothing duplicated.
      expect(collectedTied.length).toBe(new Set(collectedTied).size);
    });

    it('excludes DRAFT requests from the public list', async () => {
      const categoryId = await makeCategory();
      const ownerId = await makeUser();
      const draft = await service.create(ownerId, validCreateInput(categoryId));
      createdRequestIds.push(draft.id);

      const result = await service.list({ limit: 50 });
      expect(result.items.map((i) => i.id)).not.toContain(draft.id);
    });

    it('returns categoryName and ownerDisplayName resolved from the relations', async () => {
      const categoryId = await makeCategory();
      const ownerId = await makeUser('نمایشی‌ترین کاربر');
      const created = await service.create(
        ownerId,
        validCreateInput(categoryId),
      );
      createdRequestIds.push(created.id);
      await service.publish(created.id);

      const result = await service.list({ limit: 50 });
      const item = result.items.find((i) => i.id === created.id);
      expect(item?.categoryName).toBe('دسته تست فاز ۵');
      expect(item?.ownerDisplayName).toBe('نمایشی‌ترین کاربر');
      expect(item?.budgetMinRial).toBeNull();
      expect(item?.budgetMaxRial).toBeNull();
    });
  });
});
