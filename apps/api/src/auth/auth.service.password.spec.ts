import type { User } from '@vaqt/db';
import { AuthService } from './auth.service';
import type { PasswordAuthService } from './password/password-auth.service';

const user = {
  id: 'u1',
  phone: null,
  email: 'a@b.co',
  passwordHash: 'scrypt$x',
  mustChangePassword: false,
  username: null,
  phoneVerifiedAt: null,
  displayName: 'a',
  avatarUrl: null,
  avatarThumbnailUrl: null,
  avatarStorageKey: null,
  bio: null,
  headline: null,
  city: null,
  timezone: 'Asia/Tehran',
  systemRole: 'USER',
  status: 'ACTIVE',
  lastSeenAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} as User;
const tokens = { accessToken: 'a', refreshToken: 'r' };

function make() {
  const passwordAuth = {
    register: jest.fn().mockResolvedValue({ user, tokens }),
    login: jest.fn().mockResolvedValue({ user, tokens }),
    changePassword: jest.fn().mockResolvedValue(user),
  };
  const service = new AuthService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    passwordAuth as unknown as PasswordAuthService,
  );
  return { service, passwordAuth };
}

describe('AuthService password wrappers', () => {
  const device = { userAgent: 'x', ip: '1.1.1.1' };

  it('registerWithPassword returns the private view, never the hash', async () => {
    const { service, passwordAuth } = make();
    const input = { email: 'a@b.co', password: 'Passw0rdOK', formToken: 't' };
    const res = await service.registerWithPassword(input, device);
    expect(passwordAuth.register).toHaveBeenCalledWith(input, device);
    expect(res.tokens).toBe(tokens);
    expect(res.user).toMatchObject({ email: 'a@b.co', maskedPhone: '' });
    expect(JSON.stringify(res.user)).not.toContain('scrypt');
  });

  it('loginWithPassword returns the private view', async () => {
    const { service, passwordAuth } = make();
    const input = { email: 'a@b.co', password: 'Passw0rdOK' };
    const res = await service.loginWithPassword(input, device);
    expect(passwordAuth.login).toHaveBeenCalledWith(input, device);
    expect(res.user.email).toBe('a@b.co');
  });

  it('changePassword returns the private view, never the hash', async () => {
    const { service, passwordAuth } = make();
    const input = { currentPassword: 'old-1234', newPassword: 'NewPassw0rd' };
    const res = await service.changePassword('u1', 's1', input);
    expect(passwordAuth.changePassword).toHaveBeenCalledWith('u1', 's1', input);
    expect(res).toMatchObject({ email: 'a@b.co', mustChangePassword: false });
    expect(JSON.stringify(res)).not.toContain('scrypt');
  });
});
