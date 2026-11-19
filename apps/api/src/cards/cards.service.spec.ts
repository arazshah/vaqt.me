import { randomBytes } from 'crypto';
import { prisma } from '@vaqt/db';
import { ErrorCode } from '../common/errors/error-codes';
import { CardsService } from './cards.service';

function uniquePhone(): string {
  return `+9899${String(Date.now()).slice(-4)}${String(
    Math.floor(Math.random() * 10000),
  ).padStart(4, '0')}`;
}

describe('CardsService (real Postgres)', () => {
  const service = new CardsService();
  const userIds: string[] = [];
  const ownerPhones: string[] = [];

  const newUsername = () => `t${randomBytes(5).toString('hex')}`;

  async function makeUser(
    opts: { username?: string; status?: 'ACTIVE' | 'SUSPENDED' } = {},
  ) {
    const phone = uniquePhone();
    ownerPhones.push(phone);
    const user = await prisma.user.create({
      data: {
        phone,
        displayName: 'علی نیک‌پور',
        headline: 'مشاور کسب‌وکار',
        bio: 'ده سال تجربه',
        city: 'تهران',
        username: opts.username,
        status: opts.status ?? 'ACTIVE',
      },
    });
    userIds.push(user.id);
    return user;
  }

  afterAll(async () => {
    await prisma.contactLink.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.card.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  describe('public card', () => {
    it('returns the card without any phone number unless the owner opted in', async () => {
      const username = newUsername();
      const user = await makeUser({ username });
      await service.update(user.id, {
        template: 'night',
        links: [{ kind: 'ble', value: 'ali_n' }],
      });

      const card = await service.getPublic(username);
      expect(card.phone).toBeNull();
      expect(card.template).toBe('night');
      expect(card.links).toEqual([
        { kind: 'ble', value: 'ali_n', href: 'https://ble.ir/ali_n' },
      ]);

      // Negative test on the raw JSON: neither phone form appears anywhere.
      const json = JSON.stringify(card);
      const local = `0${user.phone.slice(3)}`;
      expect(json).not.toContain(user.phone);
      expect(json).not.toContain(user.phone.slice(3));
      expect(json).not.toContain(local);
      // Internal fields never leak.
      expect(json).not.toContain(user.id);
      for (const key of [
        'status',
        'systemRole',
        'phoneVerifiedAt',
        'avatarStorageKey',
      ]) {
        expect(card).not.toHaveProperty(key);
      }
    });

    it('shows the local phone number only after showPhone is turned on', async () => {
      const username = newUsername();
      const user = await makeUser({ username });
      await service.update(user.id, { showPhone: true });
      expect((await service.getPublic(username)).phone).toBe(
        `0${user.phone.slice(3)}`,
      );
      await service.update(user.id, { showPhone: false });
      expect((await service.getPublic(username)).phone).toBeNull();
    });

    it('is case-insensitive on the username', async () => {
      const username = newUsername();
      await makeUser({ username });
      await expect(
        service.getPublic(username.toUpperCase()),
      ).resolves.toMatchObject({ username });
    });

    it('404s for unknown, unclaimed-username and suspended users', async () => {
      const suspended = newUsername();
      await makeUser({ username: suspended, status: 'SUSPENDED' });
      for (const name of ['nobody_here_x', suspended]) {
        await expect(service.getPublic(name)).rejects.toMatchObject({
          response: { code: ErrorCode.NOT_FOUND },
        });
      }
    });
  });

  describe('update', () => {
    it('replaces links atomically, keeping the given order', async () => {
      const user = await makeUser({ username: newUsername() });
      await service.update(user.id, {
        links: [
          { kind: 'ble', value: 'a1' },
          { kind: 'instagram', value: 'a2' },
        ],
      });
      const mine = await service.update(user.id, {
        links: [{ kind: 'website', value: 'https://alinikpour.ir/' }],
      });
      expect(mine.links.map((l: { kind: string }) => l.kind)).toEqual([
        'website',
      ]);
      expect(
        await prisma.contactLink.count({ where: { userId: user.id } }),
      ).toBe(1);
    });

    it('leaves links untouched when only the template changes', async () => {
      const user = await makeUser({ username: newUsername() });
      await service.update(user.id, {
        links: [{ kind: 'ble', value: 'keep_me' }],
      });
      const mine = await service.update(user.id, { template: 'kahi' });
      expect(mine.template).toBe('kahi');
      expect(mine.links).toHaveLength(1);
    });

    it('defaults a fresh user to the tile template with the phone hidden', async () => {
      const user = await makeUser();
      const mine = await service.getMine(user.id);
      expect(mine).toMatchObject({
        template: 'tile',
        showPhone: false,
        links: [],
      });
    });
  });

  describe('setUsername', () => {
    it('claims a username and rejects one that is taken', async () => {
      const taken = newUsername();
      await makeUser({ username: taken });
      const other = await makeUser();
      await expect(service.setUsername(other.id, taken)).rejects.toMatchObject({
        response: { code: ErrorCode.USERNAME_TAKEN },
        status: 409,
      });
      const free = newUsername();
      await expect(service.setUsername(other.id, free)).resolves.toMatchObject({
        username: free,
      });
    });
  });

  describe('vCard', () => {
    it('contains the card link, never the phone when hidden, and escapes values', async () => {
      const username = newUsername();
      const user = await makeUser({ username });
      await prisma.user.update({
        where: { id: user.id },
        data: { displayName: 'علی; نیک‌پور, ج' },
      });
      await service.update(user.id, {
        links: [{ kind: 'ble', value: 'ali_n' }],
      });
      const v = await service.getVCard(username, `https://vaqt.me/${username}`);
      expect(v).toContain('BEGIN:VCARD');
      expect(v).toContain(`URL:https://vaqt.me/${username}`);
      expect(v).toContain('URL;TYPE=ble:https://ble.ir/ali_n');
      expect(v).toContain('FN:علی\\; نیک‌پور\\, ج');
      expect(v).not.toContain('TEL');
      expect(v).not.toContain(user.phone.slice(3));

      await service.update(user.id, { showPhone: true });
      expect(await service.getVCard(username, 'https://vaqt.me/x')).toContain(
        `TEL;TYPE=CELL:0${user.phone.slice(3)}`,
      );
    });
  });
});
