import { prisma, RequestStatus } from '@vaqt/db';
import { AppError } from '../common/errors/app-error';
import { RedisService } from '../common/redis/redis.service';
import { fakeConfig } from '../test-support/fake-config';
import { randomTestRedisPrefix } from '../test-support/test-db';
import { CategoriesService } from './categories.service';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6380';

describe('CategoriesService (real Postgres + Redis)', () => {
  const createdCategoryIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdRequestIds: string[] = [];
  let redis: RedisService;
  let service: CategoriesService;

  beforeEach(() => {
    redis = new RedisService(
      fakeConfig({ REDIS_URL, REDIS_PREFIX: randomTestRedisPrefix() }),
    );
    service = new CategoriesService(redis);
  });

  afterEach(async () => {
    await redis.client.quit();
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
        name: 'دسته تست',
        slug: `test-cat-${String(Date.now())}-${String(Math.random())}`,
        isActive: overrides.isActive ?? true,
      },
    });
    createdCategoryIds.push(category.id);
    return category.id;
  }

  it('list() returns only active categories', async () => {
    const activeId = await makeCategory({ isActive: true });
    const inactiveId = await makeCategory({ isActive: false });

    const { items } = await service.list();
    const ids = items.map((i) => i.id);

    expect(ids).toContain(activeId);
    expect(ids).not.toContain(inactiveId);
  });

  it('list() caches the result in Redis and returns a stable ETag on repeat calls', async () => {
    await makeCategory();
    const first = await service.list();
    const second = await service.list();

    expect(second.etag).toBe(first.etag);
    const cached = await redis.client.get(redis.key('categories:list'));
    expect(cached).not.toBeNull();
  });

  it('create() invalidates the cache so a subsequent list() reflects the new category', async () => {
    await service.list();
    const newId = await makeCategory();
    // create() below performs its own DB insert too, so also verify the
    // service-level create() path invalidates the cache.
    const created = await service.create({
      name: 'دسته تازه',
      slug: `fresh-cat-${String(Date.now())}`,
    });
    createdCategoryIds.push(created.id);

    const { items } = await service.list();
    const ids = items.map((i) => i.id);
    expect(ids).toContain(newId);
    expect(ids).toContain(created.id);
  });

  it('update() can deactivate a category with no active requests', async () => {
    const id = await makeCategory();
    const updated = await service.update(id, { isActive: false });
    expect(updated.isActive).toBe(false);
  });

  it('update() rejects deactivating a category that has a non-terminal Request pointing at it', async () => {
    const categoryId = await makeCategory();
    const user = await prisma.user.create({
      data: {
        phone: `+9899${String(Date.now()).slice(-8)}`,
        displayName: 'صاحب درخواست',
      },
    });
    createdUserIds.push(user.id);
    const request = await prisma.request.create({
      data: {
        slug: `req-${String(Date.now())}-${String(Math.random())}`,
        ownerId: user.id,
        title: 'درخواست تست',
        description: 'توضیحات تست',
        categoryId,
        mode: 'ONLINE',
        durationMinutes: 60,
        budgetMinRial: 1000000,
        budgetMaxRial: 2000000,
        deadlineAt: new Date(Date.now() + 86_400_000),
        preferredWindows: [],
        status: RequestStatus.PUBLISHED,
      },
    });
    createdRequestIds.push(request.id);

    await expect(
      service.update(categoryId, { isActive: false }),
    ).rejects.toThrow(AppError);

    const stillActive = await prisma.category.findUniqueOrThrow({
      where: { id: categoryId },
    });
    expect(stillActive.isActive).toBe(true);
  });

  it('update() allows deactivating a category whose only requests are in a terminal status', async () => {
    const categoryId = await makeCategory();
    const user = await prisma.user.create({
      data: {
        phone: `+9899${String(Date.now()).slice(-8)}`,
        displayName: 'صاحب درخواست ۲',
      },
    });
    createdUserIds.push(user.id);
    const request = await prisma.request.create({
      data: {
        slug: `req-closed-${String(Date.now())}-${String(Math.random())}`,
        ownerId: user.id,
        title: 'درخواست بسته',
        description: 'توضیحات',
        categoryId,
        mode: 'ONLINE',
        durationMinutes: 30,
        budgetMinRial: 500000,
        budgetMaxRial: 1000000,
        deadlineAt: new Date(Date.now() + 86_400_000),
        preferredWindows: [],
        status: RequestStatus.CLOSED,
      },
    });
    createdRequestIds.push(request.id);

    const updated = await service.update(categoryId, { isActive: false });
    expect(updated.isActive).toBe(false);
  });
});
