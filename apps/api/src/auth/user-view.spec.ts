import type { User } from '@vaqt/db';
import { toPrivateUser, toPublicUser } from './user-view';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    phone: '+989121234567',
    email: null,
    passwordHash: null,
    username: null,
    phoneVerifiedAt: new Date('2026-01-01T00:00:00Z'),
    displayName: 'کاربر تست',
    avatarUrl: null,
    avatarThumbnailUrl: null,
    avatarStorageKey: 'avatars/secret-internal-key.jpg',
    bio: null,
    headline: null,
    city: null,
    timezone: 'Asia/Tehran',
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

  it('never includes phoneVerifiedAt, status, systemRole or the storage key', () => {
    const result = toPublicUser(makeUser());
    for (const key of [
      'phoneVerifiedAt',
      'status',
      'systemRole',
      'avatarStorageKey',
    ]) {
      expect(result).not.toHaveProperty(key);
    }
    expect(JSON.stringify(result)).not.toContain('secret-internal-key');
  });

  it('derives phoneVerified from phoneVerifiedAt', () => {
    expect(toPublicUser(makeUser()).phoneVerified).toBe(true);
    expect(
      toPublicUser(makeUser({ phoneVerifiedAt: null })).phoneVerified,
    ).toBe(false);
  });
});

describe('toPrivateUser', () => {
  it('adds a masked phone, status and systemRole — never the raw phone', () => {
    const result = toPrivateUser(makeUser({ systemRole: 'ADMIN' }));
    expect(result.maskedPhone).toBe('+98912***4567');
    expect(result.status).toBe('ACTIVE');
    expect(result.systemRole).toBe('ADMIN');
    expect(JSON.stringify(result)).not.toContain('+989121234567');
    expect(result).not.toHaveProperty('phone');
  });
});
