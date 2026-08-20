import {
  BadRequestException,
  HttpException,
  HttpStatus,
  type ArgumentsHost,
} from '@nestjs/common';
import type { Response } from 'express';
import { AppError } from '../errors/app-error';
import { ErrorCode } from '../errors/error-codes';
import { errorMessagesFa } from '../messages/fa';
import { AllExceptionsFilter } from './all-exceptions.filter';

function makeResponse(): {
  res: Response;
  status: jest.Mock;
  json: jest.Mock;
  setHeader: jest.Mock;
} {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const setHeader = jest.fn();
  const res = { status, json, setHeader } as unknown as Response;
  return { res, status, json, setHeader };
}

function makeHost(res: Response): ArgumentsHost {
  return {
    switchToHttp: () => ({ getResponse: () => res }),
  } as unknown as ArgumentsHost;
}

describe('AllExceptionsFilter', () => {
  it('serializes an AppError to { code, message } with the right status', () => {
    const filter = new AllExceptionsFilter();
    const { res, status, json } = makeResponse();
    const error = new AppError(ErrorCode.OTP_INVALID, HttpStatus.BAD_REQUEST);

    filter.catch(error, makeHost(res));

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith({
      code: ErrorCode.OTP_INVALID,
      message: errorMessagesFa.OTP_INVALID,
    });
  });

  it('sets a Retry-After header when the AppError carries retryAfterSeconds', () => {
    const filter = new AllExceptionsFilter();
    const { res, setHeader } = makeResponse();
    const error = new AppError(
      ErrorCode.OTP_RATE_LIMITED,
      HttpStatus.TOO_MANY_REQUESTS,
      {
        retryAfterSeconds: 42,
      },
    );

    filter.catch(error, makeHost(res));

    expect(setHeader).toHaveBeenCalledWith('Retry-After', '42');
  });

  it('does not set Retry-After when the AppError has none', () => {
    const filter = new AllExceptionsFilter();
    const { res, setHeader } = makeResponse();
    filter.catch(
      new AppError(ErrorCode.OTP_INVALID, HttpStatus.BAD_REQUEST),
      makeHost(res),
    );
    expect(setHeader).not.toHaveBeenCalled();
  });

  it('includes details in the body when the AppError carries them', () => {
    const filter = new AllExceptionsFilter();
    const { res, json } = makeResponse();
    const error = new AppError(ErrorCode.OTP_INVALID, HttpStatus.BAD_REQUEST, {
      details: { attemptsRemaining: 2 },
    });

    filter.catch(error, makeHost(res));

    expect(json).toHaveBeenCalledWith({
      code: ErrorCode.OTP_INVALID,
      message: errorMessagesFa.OTP_INVALID,
      details: { attemptsRemaining: 2 },
    });
  });

  it('normalizes a plain NestJS validation HttpException to VALIDATION_ERROR, keeping its message as details', () => {
    const filter = new AllExceptionsFilter();
    const { res, status, json } = makeResponse();
    const error = new BadRequestException(['phone must be a string']);

    filter.catch(error, makeHost(res));

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith({
      code: ErrorCode.VALIDATION_ERROR,
      message: errorMessagesFa.VALIDATION_ERROR,
      details: ['phone must be a string'],
    });
  });

  it('normalizes an HttpException built from a plain string message, carrying it as details', () => {
    // Nest's HttpException constructor auto-wraps a string message into
    // { statusCode, message, error } — it is never a bare string by the
    // time getResponse() returns it, so `details` is always populated here.
    const filter = new AllExceptionsFilter();
    const { res, json } = makeResponse();
    const error = new BadRequestException('nope');

    filter.catch(error, makeHost(res));

    expect(json).toHaveBeenCalledWith({
      code: ErrorCode.VALIDATION_ERROR,
      message: errorMessagesFa.VALIDATION_ERROR,
      details: 'nope',
    });
  });

  it('omits details for a base HttpException whose response really is a bare string', () => {
    // Unlike BadRequestException and friends, the base HttpException class
    // does not auto-wrap a string response into an object — this is the
    // one case that actually exercises the `details: undefined` branch.
    const filter = new AllExceptionsFilter();
    const { res, json } = makeResponse();
    const error = new HttpException(
      'literally a string',
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(error, makeHost(res));

    expect(json).toHaveBeenCalledWith({
      code: ErrorCode.VALIDATION_ERROR,
      message: errorMessagesFa.VALIDATION_ERROR,
    });
  });

  it('falls back to INTERNAL_ERROR (500) for a completely unknown thrown value', () => {
    const filter = new AllExceptionsFilter();
    const { res, status, json } = makeResponse();

    filter.catch(new Error('boom'), makeHost(res));

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith({
      code: ErrorCode.INTERNAL_ERROR,
      message: errorMessagesFa.INTERNAL_ERROR,
    });
  });
});
