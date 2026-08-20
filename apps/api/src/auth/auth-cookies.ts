import type { Response } from 'express';
import { AuthConfigService } from './auth.config';
import type { IssuedTokens } from './session/session.service';

const REFRESH_COOKIE_PATH = '/api/v1/auth';

export function setAuthCookies(
  res: Response,
  tokens: IssuedTokens,
  config: AuthConfigService,
): void {
  const secure = process.env.NODE_ENV === 'production';

  res.cookie('access_token', tokens.accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: config.accessTokenTtlSeconds * 1000,
  });

  res.cookie('refresh_token', tokens.refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: REFRESH_COOKIE_PATH,
    maxAge: config.refreshTokenTtlSeconds * 1000,
  });
}

export function clearAuthCookies(res: Response): void {
  const secure = process.env.NODE_ENV === 'production';
  res.clearCookie('access_token', {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
  });
  res.clearCookie('refresh_token', {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: REFRESH_COOKIE_PATH,
  });
}
