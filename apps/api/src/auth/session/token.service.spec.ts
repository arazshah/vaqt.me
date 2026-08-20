import { JwtService } from '@nestjs/jwt';
import { fakeConfig } from '../../test-support/fake-config';
import { AuthConfigService } from '../auth.config';
import { TokenService } from './token.service';

function makeService(overrides: Record<string, string> = {}): TokenService {
  const config = fakeConfig({
    JWT_ACCESS_SECRET: 'access-secret',
    JWT_REFRESH_SECRET: 'refresh-secret',
    ...overrides,
  });
  return new TokenService(
    new JwtService(),
    config,
    new AuthConfigService(config),
  );
}

describe('TokenService', () => {
  it('throws at construction if JWT_ACCESS_SECRET is missing', () => {
    const config = fakeConfig({ JWT_REFRESH_SECRET: 'refresh-secret' });
    expect(
      () =>
        new TokenService(
          new JwtService(),
          config,
          new AuthConfigService(config),
        ),
    ).toThrow('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set');
  });

  it('throws at construction if JWT_REFRESH_SECRET is missing', () => {
    const config = fakeConfig({ JWT_ACCESS_SECRET: 'access-secret' });
    expect(
      () =>
        new TokenService(
          new JwtService(),
          config,
          new AuthConfigService(config),
        ),
    ).toThrow('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set');
  });

  it('signs and verifies an access token round-trip', () => {
    const service = makeService();
    const token = service.signAccessToken({ sub: 'user-1', sid: 'session-1' });
    const payload = service.verifyAccessToken(token);
    expect(payload.sub).toBe('user-1');
    expect(payload.sid).toBe('session-1');
  });

  it('signs and verifies a refresh token round-trip', () => {
    const service = makeService();
    const token = service.signRefreshToken({ sub: 'user-1', sid: 'session-1' });
    const payload = service.verifyRefreshToken(token);
    expect(payload.sub).toBe('user-1');
    expect(payload.sid).toBe('session-1');
  });

  it('the payload carries only sub and sid, nothing else', () => {
    const service = makeService();
    const token = service.signAccessToken({ sub: 'user-1', sid: 'session-1' });
    const decoded = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
    ) as Record<string, unknown>;
    const { iat: _iat, exp: _exp, ...rest } = decoded;
    expect(rest).toEqual({ sub: 'user-1', sid: 'session-1' });
  });

  it('rejects an access token when verified with the refresh secret', () => {
    const service = makeService();
    const token = service.signAccessToken({ sub: 'user-1', sid: 'session-1' });
    expect(() => service.verifyRefreshToken(token)).toThrow();
  });

  it('rejects an expired access token', () => {
    const config = fakeConfig({
      JWT_ACCESS_SECRET: 'access-secret',
      JWT_REFRESH_SECRET: 'refresh-secret',
      JWT_ACCESS_TTL_SECONDS: '-1',
    });
    const service = new TokenService(
      new JwtService(),
      config,
      new AuthConfigService(config),
    );
    const token = service.signAccessToken({ sub: 'user-1', sid: 'session-1' });
    expect(() => service.verifyAccessToken(token)).toThrow();
  });

  it('rejects a garbage token', () => {
    const service = makeService();
    expect(() => service.verifyAccessToken('not-a-jwt')).toThrow();
  });
});
