import { randomBytes } from 'crypto';
import { prisma } from '@vaqt/db';
import { ErrorCode } from '../common/errors/error-codes';
import { RedisService } from '../common/redis/redis.service';
import { fakeConfig } from '../test-support/fake-config';
import { randomTestRedisPrefix } from '../test-support/test-db';
import { WalletService } from './wallet.service';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6380';

function uniquePhone(): string {
  return `+9899${String(Date.now()).slice(-4)}${String(
    Math.floor(Math.random() * 10000),
  ).padStart(4, '0')}`;
}

describe('WalletService (real Postgres + Redis)', () => {
  const userIds: string[] = [];
  let redis: RedisService;
  let wallet: WalletService;

  beforeEach(() => {
    redis = new RedisService(
      fakeConfig({ REDIS_URL, REDIS_PREFIX: randomTestRedisPrefix() }),
    );
    wallet = new WalletService(redis);
  });
  afterEach(async () => {
    await redis.client.quit();
  });
  afterAll(async () => {
    await prisma.savedCard.deleteMany({
      where: {
        OR: [{ ownerId: { in: userIds } }, { cardUserId: { in: userIds } }],
      },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  async function makeUser(
    opts: { card?: boolean; status?: 'ACTIVE' | 'SUSPENDED' } = {},
  ) {
    const user = await prisma.user.create({
      data: {
        phone: uniquePhone(),
        displayName: 'کاربر تست',
        headline: 'مشاور',
        username:
          opts.card === false ? null : `w${randomBytes(5).toString('hex')}`,
        status: opts.status ?? 'ACTIVE',
      },
    });
    userIds.push(user.id);
    return { id: user.id, username: user.username ?? '' };
  }

  it('saves a card idempotently and lists it newest-first with public fields only', async () => {
    const [me, a, b] = [await makeUser(), await makeUser(), await makeUser()];
    await wallet.save(me.id, a.username);
    await wallet.save(me.id, a.username);
    await wallet.save(me.id, b.username);
    const list = await wallet.list(me.id);
    expect(list.map((e) => e.username)).toEqual([b.username, a.username]);
    expect(list[0]).toMatchObject({ source: 'saved', headline: 'مشاور' });
    const json = JSON.stringify(list);
    const phone = (await prisma.user.findUniqueOrThrow({ where: { id: a.id } }))
      .phone;
    expect(json).not.toContain(phone.slice(3));
    expect(list[0]).not.toHaveProperty('id');
  });

  it('cannot save your own card, or one that does not exist or is suspended', async () => {
    const me = await makeUser();
    const suspended = await makeUser({ status: 'SUSPENDED' });
    await expect(wallet.save(me.id, me.username)).rejects.toMatchObject({
      response: { code: ErrorCode.WALLET_OWN_CARD },
    });
    for (const name of ['nobody_here', suspended.username]) {
      await expect(wallet.save(me.id, name)).rejects.toMatchObject({
        response: { code: ErrorCode.NOT_FOUND },
      });
    }
  });

  it('exchange puts each card in the other wallet, marked as exchanged', async () => {
    const [me, other] = [await makeUser(), await makeUser()];
    const status = await wallet.exchange(me.id, other.username);
    expect(status).toEqual({ saved: true, exchanged: true });
    expect((await wallet.list(me.id))[0]).toMatchObject({
      username: other.username,
      source: 'exchanged',
    });
    expect((await wallet.list(other.id))[0]).toMatchObject({
      username: me.username,
      source: 'exchanged',
    });
  });

  it('exchange upgrades an earlier plain save instead of duplicating it', async () => {
    const [me, other] = [await makeUser(), await makeUser()];
    await wallet.save(me.id, other.username);
    await wallet.exchange(me.id, other.username);
    expect(await prisma.savedCard.count({ where: { ownerId: me.id } })).toBe(1);
    expect((await wallet.status(me.id, other.username)).exchanged).toBe(true);
  });

  it('exchange needs a card of your own', async () => {
    const noCard = await makeUser({ card: false });
    const other = await makeUser();
    await expect(
      wallet.exchange(noCard.id, other.username),
    ).rejects.toMatchObject({
      response: { code: ErrorCode.CARD_REQUIRED_FOR_EXCHANGE },
    });
    expect(
      await prisma.savedCard.count({ where: { cardUserId: noCard.id } }),
    ).toBe(0);
  });

  it('caps new exchanges per day, but re-sending to an existing partner is free', async () => {
    const me = await makeUser();
    const partners = await Promise.all(
      Array.from({ length: 21 }, () => makeUser()),
    );
    for (const p of partners.slice(0, 20))
      await wallet.exchange(me.id, p.username);
    await expect(
      wallet.exchange(me.id, partners[20].username),
    ).rejects.toMatchObject({
      response: { code: ErrorCode.EXCHANGE_LIMIT_REACHED },
    });
    expect(
      await prisma.savedCard.count({ where: { ownerId: partners[20].id } }),
    ).toBe(0);
    await expect(
      wallet.exchange(me.id, partners[0].username),
    ).resolves.toMatchObject({ exchanged: true });
  }, 30_000); // 22 users + 21 sequential exchanges: slow when the machine is busy

  it("removing only deletes the caller's copy", async () => {
    const [me, other] = [await makeUser(), await makeUser()];
    await wallet.exchange(me.id, other.username);
    await wallet.remove(me.id, other.username);
    expect(await wallet.list(me.id)).toEqual([]);
    expect(await wallet.list(other.id)).toHaveLength(1);
    await expect(wallet.remove(me.id, other.username)).resolves.toBeUndefined(); // idempotent
  });

  it('hides wallet entries whose owner later suspended or dropped their username', async () => {
    const [me, a, b] = [await makeUser(), await makeUser(), await makeUser()];
    await wallet.save(me.id, a.username);
    await wallet.save(me.id, b.username);
    await prisma.user.update({
      where: { id: a.id },
      data: { status: 'SUSPENDED' },
    });
    await prisma.user.update({ where: { id: b.id }, data: { username: null } });
    expect(await wallet.list(me.id)).toEqual([]);
  });
});
