import { randomBytes } from 'crypto';
import { prisma } from '@vaqt/db';
import { KvService } from '../common/kv/kv.service';
import { CardAnalyticsService } from './card-analytics.service';

function uniquePhone(): string {
  return `+9899${String(Date.now()).slice(-4)}${String(
    Math.floor(Math.random() * 10000),
  ).padStart(4, '0')}`;
}

describe('CardAnalyticsService (real Postgres + Redis)', () => {
  const userIds: string[] = [];
  let redis: KvService;
  let service: CardAnalyticsService;

  beforeEach(() => {
    redis = new KvService();
    service = new CardAnalyticsService(redis);
  });
  afterAll(async () => {
    await prisma.cardEvent.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.booking.deleteMany({ where: { providerId: { in: userIds } } });
    await prisma.serviceType.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  async function makeOwner(status: 'ACTIVE' | 'SUSPENDED' = 'ACTIVE') {
    const user = await prisma.user.create({
      data: {
        phone: uniquePhone(),
        displayName: 'علی',
        username: `a${randomBytes(5).toString('hex')}`,
        status,
      },
    });
    userIds.push(user.id);
    return { id: user.id, username: user.username ?? '' };
  }

  it('counts a view once per visitor within the dedupe window, but different visitors separately', async () => {
    const { id, username } = await makeOwner();
    await service.record(
      username,
      { type: 'view', source: 'qr-office' },
      '1.1.1.1',
    );
    await service.record(
      username,
      { type: 'view', source: 'qr-office' },
      '1.1.1.1',
    ); // reload
    await service.record(username, { type: 'view' }, '2.2.2.2');
    const stats = await service.stats(id, 7);
    expect(stats.views).toBe(2);
    expect(stats.qrScans).toBe(1);
    expect(stats.bySource).toEqual(
      expect.arrayContaining([
        { source: 'qr-office', views: 1 },
        { source: 'direct', views: 1 },
      ]),
    );
  });

  it('counts clicks per link kind and ignores a linkKind on non-click events', async () => {
    const { id, username } = await makeOwner();
    for (let i = 0; i < 3; i++) {
      await service.record(
        username,
        { type: 'link_click', linkKind: 'ble' },
        '3.3.3.3',
      );
    }
    await service.record(
      username,
      { type: 'link_click', linkKind: 'instagram' },
      '3.3.3.3',
    );
    await service.record(
      username,
      { type: 'save_contact', linkKind: 'ble' },
      '3.3.3.3',
    );
    await service.record(username, { type: 'book_click' }, '3.3.3.3');
    const stats = await service.stats(id, 7);
    expect(stats.byLink).toEqual([
      { kind: 'ble', clicks: 3 },
      { kind: 'instagram', clicks: 1 },
    ]);
    expect(stats).toMatchObject({
      linkClicks: 4,
      contactSaves: 1,
      bookClicks: 1,
    });
  });

  it('stores unknown sources as "other" and never stores the IP', async () => {
    const { id, username } = await makeOwner();
    await service.record(
      username,
      { type: 'view', source: 'x'.repeat(30) },
      '203.0.113.9',
    );
    const rows = await prisma.cardEvent.findMany({ where: { userId: id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].source).toBe('other');
    expect(JSON.stringify(rows)).not.toContain('203.0.113.9');
  });

  it('drops events past the hourly limit silently', async () => {
    const { id, username } = await makeOwner();
    for (let i = 0; i < 125; i++) {
      await service.record(username, { type: 'book_click' }, '9.9.9.9');
    }
    expect((await service.stats(id, 7)).bookClicks).toBe(120);
  });

  it('answers the same for unknown or suspended cards and records nothing', async () => {
    const suspended = await makeOwner('SUSPENDED');
    await expect(
      service.record('nobody_here', { type: 'view' }, '4.4.4.4'),
    ).resolves.toBeUndefined();
    await expect(
      service.record(suspended.username, { type: 'view' }, '4.4.4.4'),
    ).resolves.toBeUndefined();
    expect(
      await prisma.cardEvent.count({ where: { userId: suspended.id } }),
    ).toBe(0);
  });

  it('returns one daily entry per day (zero-filled) and events outside the window are excluded', async () => {
    const { id, username } = await makeOwner();
    await service.record(username, { type: 'view' }, '5.5.5.5');
    await prisma.cardEvent.create({
      data: {
        userId: id,
        type: 'view',
        source: 'direct',
        createdAt: new Date(Date.now() - 20 * 86_400_000),
      },
    });
    const week = await service.stats(id, 7);
    expect(week.daily).toHaveLength(7);
    expect(week.daily.reduce((n, d) => n + d.views, 0)).toBe(1);
    expect(week.daily.at(-1)?.views).toBe(1); // today
    expect(week.views).toBe(1);
    const month = await service.stats(id, 30);
    expect(month.daily).toHaveLength(30);
    expect(month.views).toBe(2);
  });
});
