import type { User } from '@vaqt/db';
import { toPublicUser } from './user-view';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    phone: '+989121234567',
    phoneVerifiedAt: new Date('2026-01-01T00:00:00Z'),
    displayName: 'کاربر تست',
    avatarUrl: null,
    avatarThumbnailUrl: null,
    avatarStorageKey: 'avatars/secret-internal-key.jpg',
    bio: null,
    headline: null,
    city: null,
    modePreference: null,
    linkedinUrl: null,
    timezone: 'Asia/Tehran',
    ratingAvg: 0,
    ratingCount: 0,
    roleIntent: 'SEEKER',
    systemRole: 'USER',
    status: 'ACTIVE',
    lastSeenAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('toPublicUser', () => {
  it('never includes the phone number, under any key', () => {
    const result = toPublicUser(makeUser());
    expect(JSON.stringify(result)).not.toContain('+989121234567');
    expect(result).not.toHaveProperty('phone');
  });

  it('never includes the raw phoneVerifiedAt timestamp', () => {
    const result = toPublicUser(makeUser());
    expect(result).not.toHaveProperty('phoneVerifiedAt');
  });

  it('derives phoneVerified: true from a non-null phoneVerifiedAt', () => {
    const result = toPublicUser(makeUser({ phoneVerifiedAt: new Date() }));
    expect(result.phoneVerified).toBe(true);
  });

  it('derives phoneVerified: false from a null phoneVerifiedAt', () => {
    const result = toPublicUser(makeUser({ phoneVerifiedAt: null }));
    expect(result.phoneVerified).toBe(false);
  });

  it('never includes status (block state)', () => {
    const result = toPublicUser(makeUser({ status: 'SUSPENDED' }));
    expect(result).not.toHaveProperty('status');
  });

  it('never includes systemRole', () => {
    const result = toPublicUser(makeUser({ systemRole: 'ADMIN' }));
    expect(result).not.toHaveProperty('systemRole');
  });

  it('never includes avatarStorageKey (internal-only field)', () => {
    const result = toPublicUser(makeUser());
    expect(result).not.toHaveProperty('avatarStorageKey');
    expect(JSON.stringify(result)).not.toContain('secret-internal-key');
  });

  it('defaults skills to an empty array when the relation was not loaded', () => {
    const result = toPublicUser(makeUser());
    expect(result.skills).toEqual([]);
  });

  it('maps loaded UserSkill relations to the flat {id, slug, name} shape', () => {
    const user = makeUser();
    const result = toPublicUser({
      ...user,
      skills: [
        { skill: { id: 's1', slug: 'python', name: 'پایتون' } },
        { skill: { id: 's2', slug: 'react', name: 'ری‌اکت' } },
      ],
    });
    expect(result.skills).toEqual([
      { id: 's1', slug: 'python', name: 'پایتون' },
      { id: 's2', slug: 'react', name: 'ری‌اکت' },
    ]);
  });

  it('passes through the remaining public profile fields unchanged', () => {
    const user = makeUser({
      displayName: 'علی محمدی',
      headline: 'توسعه‌دهنده',
      bio: 'یک بیو',
      avatarUrl: 'https://example.com/a.jpg',
      avatarThumbnailUrl: 'https://example.com/a-thumb.jpg',
      city: 'تهران',
      modePreference: 'ONLINE',
      linkedinUrl: 'https://linkedin.com/in/x',
      timezone: 'Asia/Tehran',
      ratingAvg: 4.5,
      ratingCount: 12,
    });
    const result = toPublicUser(user);
    expect(result).toMatchObject({
      id: 'user-1',
      displayName: 'علی محمدی',
      headline: 'توسعه‌دهنده',
      bio: 'یک بیو',
      avatarUrl: 'https://example.com/a.jpg',
      avatarThumbnailUrl: 'https://example.com/a-thumb.jpg',
      city: 'تهران',
      modePreference: 'ONLINE',
      linkedinUrl: 'https://linkedin.com/in/x',
      timezone: 'Asia/Tehran',
      roleIntent: 'SEEKER',
      ratingAvg: 4.5,
      ratingCount: 12,
    });
  });
});
