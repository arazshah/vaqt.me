import type { NextFunction, Request, Response } from 'express';
import { ErrorCode } from '../errors/error-codes';
import { errorMessagesFa } from '../messages/fa';
import { createOriginCheckMiddleware } from './origin-check.middleware';

const WEB_ORIGIN = 'http://localhost:3000';

function makeReqRes(overrides: {
  method: string;
  origin?: string;
  referer?: string;
}): {
  req: Request;
  res: Response;
  next: NextFunction;
  status: jest.Mock;
  json: jest.Mock;
} {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const req = {
    method: overrides.method,
    headers: {
      origin: overrides.origin,
      referer: overrides.referer,
    },
  } as unknown as Request;
  const res = { status, json } as unknown as Response;
  const next = jest.fn();
  return { req, res, next, status, json };
}

describe('createOriginCheckMiddleware', () => {
  const middleware = createOriginCheckMiddleware(WEB_ORIGIN);

  it.each(['GET', 'HEAD', 'OPTIONS'])(
    'passes non-mutating method %s through without checking Origin',
    (method) => {
      const { req, res, next } = makeReqRes({ method });
      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    },
  );

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])(
    'allows a mutating %s request whose Origin matches exactly',
    (method) => {
      const { req, res, next } = makeReqRes({ method, origin: WEB_ORIGIN });
      middleware(req, res, next);
      expect(next).toHaveBeenCalled();
    },
  );

  it('rejects a mutating request with a mismatched Origin', () => {
    const { req, res, next, status, json } = makeReqRes({
      method: 'POST',
      origin: 'https://evil.example',
    });
    middleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({
      code: ErrorCode.FORBIDDEN,
      message: errorMessagesFa.FORBIDDEN,
    });
  });

  it('rejects a mutating request with neither Origin nor Referer', () => {
    const { req, res, next, status } = makeReqRes({ method: 'POST' });
    middleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
  });

  it('falls back to Referer when Origin is absent, allowing a matching one', () => {
    const { req, res, next } = makeReqRes({
      method: 'POST',
      referer: `${WEB_ORIGIN}/some/page?query=1`,
    });
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('rejects when the Referer origin does not match, even with a different path', () => {
    const { req, res, next, status } = makeReqRes({
      method: 'POST',
      referer: 'https://evil.example/some/page',
    });
    middleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
  });

  it('rejects when Referer is present but unparseable as a URL', () => {
    const { req, res, next, status } = makeReqRes({
      method: 'POST',
      referer: 'not-a-valid-url',
    });
    middleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
  });

  it('prefers Origin over Referer when both are present', () => {
    const { req, res, next } = makeReqRes({
      method: 'POST',
      origin: WEB_ORIGIN,
      referer: 'https://evil.example/some/page',
    });
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
