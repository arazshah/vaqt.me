import type { Request, Response } from 'express';
import { UnauthorizedException } from '@nestjs/common';
import { fakeConfig } from '../test-support/fake-config';
import { AuthConfigService } from './auth.config';
import { AuthController } from './auth.controller';
import type { AuthService } from './auth.service';

function makeResponse(): { res: Response; cookie: jest.Mock } {
  const cookie = jest.fn();
  return {
    res: { cookie, clearCookie: jest.fn() } as unknown as Response,
    cookie,
  };
}

function makeAuth(): jest.Mocked<AuthService> {
  return {
    requestOtp: jest.fn(),
    verifyOtp: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
    logoutAll: jest.fn(),
    getMe: jest.fn(),
    updateRole: jest.fn(),
    createWsTicket: jest.fn(),
  } as unknown as jest.Mocked<AuthService>;
}

const config = new AuthConfigService(fakeConfig({}));

describe('AuthController', () => {
  it('requestOtp delegates to AuthService.requestOtp with the DTO phone and the request IP', async () => {
    const auth = makeAuth();
    auth.requestOtp.mockResolvedValue({
      ok: true,
      expiresIn: 120,
      resendAfter: 60,
    });
    const controller = new AuthController(auth, config);

    await controller.requestOtp({ phone: '09123456789' }, '198.51.100.1');

    expect(auth.requestOtp).toHaveBeenCalledWith('09123456789', '198.51.100.1');
  });

  it('verifyOtp sets auth cookies and returns only { user }, not the tokens', async () => {
    const auth = makeAuth();
    const user = { id: 'u1' } as never;
    auth.verifyOtp.mockResolvedValue({
      user,
      tokens: { accessToken: 'a', refreshToken: 'b' },
    });
    const controller = new AuthController(auth, config);
    const { res, cookie } = makeResponse();
    const req = {
      headers: { 'user-agent': 'jest' },
      ip: '198.51.100.2',
    } as Request;

    const result = await controller.verifyOtp(
      { phone: '09123456789', code: '12345' },
      req,
      res,
    );

    expect(result).toEqual({ user });
    expect(cookie).toHaveBeenCalledWith(
      'access_token',
      'a',
      expect.any(Object),
    );
    expect(cookie).toHaveBeenCalledWith(
      'refresh_token',
      'b',
      expect.any(Object),
    );
  });

  it('refresh reads the refresh_token cookie, rotates it, and sets new cookies', async () => {
    const auth = makeAuth();
    auth.refresh.mockResolvedValue({ accessToken: 'a2', refreshToken: 'b2' });
    const controller = new AuthController(auth, config);
    const { res, cookie } = makeResponse();
    const req = {
      headers: { 'user-agent': 'jest' },
      ip: '198.51.100.3',
      cookies: { refresh_token: 'old-refresh' },
    } as unknown as Request;

    const result = await controller.refresh(req, res);

    expect(auth.refresh).toHaveBeenCalledWith('old-refresh', {
      userAgent: 'jest',
      ip: '198.51.100.3',
    });
    expect(result).toEqual({ ok: true });
    expect(cookie).toHaveBeenCalledWith(
      'access_token',
      'a2',
      expect.any(Object),
    );
  });

  it('refresh throws UnauthorizedException when there is no refresh_token cookie', async () => {
    const auth = makeAuth();
    const controller = new AuthController(auth, config);
    const { res } = makeResponse();
    const req = {
      headers: {},
      ip: '198.51.100.4',
      cookies: {},
    } as unknown as Request;

    await expect(controller.refresh(req, res)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(auth.refresh).not.toHaveBeenCalled();
  });

  it('logout revokes the current session (from CurrentUser) and clears cookies', async () => {
    const auth = makeAuth();
    const controller = new AuthController(auth, config);
    const { res } = makeResponse();

    const result = await controller.logout({ sub: 'u1', sid: 's1' }, res);

    expect(auth.logout).toHaveBeenCalledWith('u1', 's1');
    expect(result).toEqual({ ok: true });
  });

  it('logoutAll revokes every session for the current user and clears cookies', async () => {
    const auth = makeAuth();
    const controller = new AuthController(auth, config);
    const { res } = makeResponse();

    const result = await controller.logoutAll({ sub: 'u1', sid: 's1' }, res);

    expect(auth.logoutAll).toHaveBeenCalledWith('u1');
    expect(result).toEqual({ ok: true });
  });

  it('getMe delegates to AuthService.getMe with the current user id', async () => {
    const auth = makeAuth();
    const controller = new AuthController(auth, config);
    await controller.getMe({ sub: 'u1', sid: 's1' });
    expect(auth.getMe).toHaveBeenCalledWith('u1');
  });

  it('updateRole delegates to AuthService.updateRole with the current user id and dto', async () => {
    const auth = makeAuth();
    const controller = new AuthController(auth, config);
    await controller.updateRole(
      { sub: 'u1', sid: 's1' },
      { roleIntent: 'PROVIDER' },
    );
    expect(auth.updateRole).toHaveBeenCalledWith('u1', 'PROVIDER');
  });

  it('createWsTicket delegates to AuthService.createWsTicket with the current user id', async () => {
    const auth = makeAuth();
    const controller = new AuthController(auth, config);
    await controller.createWsTicket({ sub: 'u1', sid: 's1' });
    expect(auth.createWsTicket).toHaveBeenCalledWith('u1');
  });
});
