import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from './error-codes';
import { errorMessagesFa } from '../messages/fa';

export class AppError extends HttpException {
  readonly code: ErrorCode;
  readonly retryAfterSeconds?: number;

  constructor(
    code: ErrorCode,
    status: HttpStatus,
    options?: { details?: unknown; retryAfterSeconds?: number },
  ) {
    super(
      {
        code,
        message: errorMessagesFa[code],
        ...(options?.details !== undefined ? { details: options.details } : {}),
      },
      status,
    );
    this.code = code;
    this.retryAfterSeconds = options?.retryAfterSeconds;
  }
}
