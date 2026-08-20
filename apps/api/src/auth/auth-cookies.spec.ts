import type { Response } from 'express';
import { fakeConfig } from '../test-support/fake-config';
import { AuthConfigService } from './auth.config';
import { clearAuthCookies, setAuthCookies } from './auth-cookies';
import type { IssuedTokens } from './session/session.service';

type CookieOptions = Record<string, unknown>;
type CookieMock = jest.Mock<unknown, [string, string, CookieOptions]>;

function makeResponse(): {
  res: Response;
  cookie: CookieMock;
  clearCookie: jest.Mock;
} {
  const cookie: CookieMock = jest.fn<
    unknown,
    [string, string, CookieOptions]
  >();
  const clearCookie = jest.fn();
  return {
    res: { cookie, clearCookie } as unknown as Response,
    cookie,
    clearCookie,
  };
}

const TOKENS: IssuedTokens = {
  accessToken: 'access.jwt',
  refreshToken: 'refresh.jwt',
};
const config = new AuthConfigService(
  fakeConfig({
    JWT_ACCESS_TTL_SECONDS: '900',
    JWT_REFRESH_TTL_SECONDS: '2592000',
  }),
);

describe('auth cookies', () => {
  afterEach(() => {
    delete process.env.NODE_ENV;
  });

  it('sets both cookies as httpOnly, SameSite=Lax, with the right paths and maxAge', () => {
    process.env.NODE_ENV = 'development';
    const { res, cookie } = makeResponse();

    setAuthCookies(res, TOKENS, config);

    expect(cookie).toHaveBeenCalledWith('access_token', 'access.jwt', {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
      maxAge: 900 * 1000,
    });
    expect(cookie).toHaveBeenCalledWith('refresh_token', 'refresh.jwt', {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/api/v1/auth',
      maxAge: 2592000 * 1000,
    });
  });

  it('sets secure: true in production', () => {
    process.env.NODE_ENV = 'production';
    const { res, cookie } = makeResponse();

    setAuthCookies(res, TOKENS, config);

    const accessCall = cookie.mock.calls.find(
      (call) => call[0] === 'access_token',
    );
    expect(accessCall?.[2].secure).toBe(true);
  });

  it('clearAuthCookies clears both cookies with matching paths', () => {
    process.env.NODE_ENV = 'development';
    const { res, clearCookie } = makeResponse();

    clearAuthCookies(res);

    expect(clearCookie).toHaveBeenCalledWith('access_token', {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
    });
    expect(clearCookie).toHaveBeenCalledWith('refresh_token', {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/api/v1/auth',
    });
  });
});
