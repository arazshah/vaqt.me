import { randomBytes } from 'crypto';
import { prisma } from '@vaqt/db';
import { ErrorCode } from '../common/errors/error-codes';
import { CardsService } from './cards.service';
import { randomTestPhone } from '../test-support/test-db';

function uniquePhone(): string {
  return randomTestPhone();
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
      const local = `0${(user.phone ?? '').slice(3)}`;
      expect(json).not.toContain(user.phone);
      expect(json).not.toContain((user.phone ?? '').slice(3));
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
        `0${(user.phone ?? '').slice(3)}`,
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

    it('stores, changes and clears the professional category', async () => {
      const user = await makeUser({ username: newUsername() });
      expect((await service.getMine(user.id)).category).toBeNull();
      const set = await service.update(user.id, { category: 'health' });
      expect(set.category).toBe('health');
      const other = await service.update(user.id, { template: 'night' });
      expect(other.category).toBe('health');
      const cleared = await service.update(user.id, { category: null });
      expect(cleared.category).toBeNull();
    });

    it('accepts the new marble and aurora templates', async () => {
      const user = await makeUser({ username: newUsername() });
      expect(
        (await service.update(user.id, { template: 'marble' })).template,
      ).toBe('marble');
      expect(
        (await service.update(user.id, { template: 'aurora' })).template,
      ).toBe('aurora');
    });

    it('shows every card field by default and stores the owner choice', async () => {
      const username = newUsername();
      const user = await makeUser({ username });
      expect((await service.getMine(user.id)).cardFields).toEqual([
        'avatar',
        'phone',
        'address',
        'website',
        'messengers',
      ]);
      const mine = await service.update(user.id, {
        cardFields: ['phone', 'messengers'],
      });
      expect(mine.cardFields).toEqual(['phone', 'messengers']);
      expect((await service.getPublic(username)).cardFields).toEqual([
        'phone',
        'messengers',
      ]);
      // Other updates leave the choice alone.
      const after = await service.update(user.id, { template: 'night' });
      expect(after.cardFields).toEqual(['phone', 'messengers']);
      const none = await service.update(user.id, { cardFields: [] });
      expect(none.cardFields).toEqual([]);
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

  describe('contact info and map pin', () => {
    it('publishes the typed phone, address and location, and can clear them', async () => {
      const username = newUsername();
      const user = await makeUser({ username });
      await service.update(user.id, {
        contactPhone: '02112345678',
        address: 'تهران، خیابان ولیعصر',
        location: { lat: 35.7, lng: 51.4 },
      });

      const card = await service.getPublic(username);
      expect(card.phone).toBe('02112345678');
      expect(card.address).toBe('تهران، خیابان ولیعصر');
      expect(card.location).toEqual({ lat: 35.7, lng: 51.4 });
      // The account phone never leaks just because a contact phone exists.
      expect(JSON.stringify(card)).not.toContain(user.phone ?? 'x');

      const vcard = await service.getVCard(username, 'https://vaqt.me/x');
      expect(vcard).toContain('TEL;TYPE=CELL:02112345678');
      expect(vcard).toContain('GEO:35.7;51.4');

      await service.update(user.id, {
        contactPhone: null,
        address: null,
        location: null,
      });
      const cleared = await service.getPublic(username);
      expect(cleared.phone).toBeNull();
      expect(cleared.address).toBeNull();
      expect(cleared.location).toBeNull();
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
      expect(v).not.toContain((user.phone ?? '').slice(3));

      await service.update(user.id, { showPhone: true });
      expect(await service.getVCard(username, 'https://vaqt.me/x')).toContain(
        `TEL;TYPE=CELL:0${(user.phone ?? '').slice(3)}`,
      );
    });
  });
});
