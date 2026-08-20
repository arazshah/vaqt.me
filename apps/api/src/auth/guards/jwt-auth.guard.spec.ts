import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { ExecutionContext } from '@nestjs/common';
import { AppError } from '../../common/errors/app-error';
import { fakeConfig } from '../../test-support/fake-config';
import { AuthConfigService } from '../auth.config';
import type { AuthenticatedRequest } from '../auth-request';
import { TokenService } from '../session/token.service';
import { JwtAuthGuard } from './jwt-auth.guard';

function makeTokens(): TokenService {
  const config = fakeConfig({
    JWT_ACCESS_SECRET: 'access-secret',
    JWT_REFRESH_SECRET: 'refresh-secret',
  });
  return new TokenService(
    new JwtService(),
    config,
    new AuthConfigService(config),
  );
}

function setup(
  request: Partial<AuthenticatedRequest>,
  isPublic: boolean,
): {
  guard: JwtAuthGuard;
  context: ExecutionContext;
  request: Partial<AuthenticatedRequest>;
} {
  const reflector = new Reflector();
  jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(isPublic);
  const guard = new JwtAuthGuard(reflector, makeTokens());
  const context = {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { guard, context, request };
}

describe('JwtAuthGuard', () => {
  it('allows a @Public() route without any token', () => {
    const { guard, context } = setup({ headers: {}, cookies: {} }, true);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws UNAUTHORIZED when no token is present anywhere', () => {
    const { guard, context } = setup({ headers: {}, cookies: {} }, false);
    expect(() => guard.canActivate(context)).toThrow(AppError);
  });

  it('authenticates via the access_token cookie and populates request.user', () => {
    const tokens = makeTokens();
    const token = tokens.signAccessToken({ sub: 'user-1', sid: 'session-1' });
    const { guard, context, request } = setup(
      { headers: {}, cookies: { access_token: token } },
      false,
    );

    expect(guard.canActivate(context)).toBe(true);
    expect(request.user?.sub).toBe('user-1');
    expect(request.user?.sid).toBe('session-1');
  });

  it('authenticates via a Bearer authorization header when no cookie is present', () => {
    const tokens = makeTokens();
    const token = tokens.signAccessToken({ sub: 'user-2', sid: 'session-2' });
    const { guard, context, request } = setup(
      { headers: { authorization: `Bearer ${token}` }, cookies: {} },
      false,
    );

    expect(guard.canActivate(context)).toBe(true);
    expect(request.user?.sub).toBe('user-2');
  });

  it('prefers the cookie over the Authorization header when both are present', () => {
    const tokens = makeTokens();
    const cookieToken = tokens.signAccessToken({
      sub: 'cookie-user',
      sid: 'session-c',
    });
    const headerToken = tokens.signAccessToken({
      sub: 'header-user',
      sid: 'session-h',
    });
    const { guard, context, request } = setup(
      {
        headers: { authorization: `Bearer ${headerToken}` },
        cookies: { access_token: cookieToken },
      },
      false,
    );

    guard.canActivate(context);
    expect(request.user?.sub).toBe('cookie-user');
  });

  it('ignores a malformed Authorization header (no Bearer prefix)', () => {
    const { guard, context } = setup(
      { headers: { authorization: 'Basic abc123' }, cookies: {} },
      false,
    );
    expect(() => guard.canActivate(context)).toThrow(AppError);
  });

  it('throws UNAUTHORIZED for a garbage/expired token', () => {
    const { guard, context } = setup(
      { headers: {}, cookies: { access_token: 'not-a-real-jwt' } },
      false,
    );
    expect(() => guard.canActivate(context)).toThrow(AppError);
  });
});
