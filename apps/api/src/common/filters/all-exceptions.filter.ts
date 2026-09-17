import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { AppError } from '../errors/app-error';
import { ErrorCode } from '../errors/error-codes';
import { errorMessagesFa } from '../messages/fa';

interface NestExceptionBody {
  message?: string | string[];
  // Only nestjs-zod's ZodValidationException carries this — the full list
  // of per-field zod issues ({ path, message, code, ... }), not just the
  // generic "Validation failed" top-level message.
  errors?: unknown;
}

// Codes with a status this filter can pick without knowing the throw site
// (AppError callers pick their own code+status explicitly; this is only for
// exceptions that reach here as a plain NestJS HttpException).
const STATUS_TO_ERROR_CODE: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: ErrorCode.VALIDATION_ERROR,
  [HttpStatus.UNAUTHORIZED]: ErrorCode.UNAUTHORIZED,
  [HttpStatus.FORBIDDEN]: ErrorCode.FORBIDDEN,
  [HttpStatus.NOT_FOUND]: ErrorCode.NOT_FOUND,
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof AppError) {
      if (exception.retryAfterSeconds !== undefined) {
        response.setHeader('Retry-After', String(exception.retryAfterSeconds));
      }
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const bodyObj =
        typeof body === 'object' ? (body as NestExceptionBody) : undefined;
      // Prefer the structured per-field errors (nestjs-zod) over the
      // generic top-level message, which never named which field failed.
      const details = bodyObj?.errors ?? bodyObj?.message;
      const code = STATUS_TO_ERROR_CODE[status] ?? ErrorCode.VALIDATION_ERROR;

      response.status(status).json({
        code,
        message: errorMessagesFa[code],
        ...(details !== undefined ? { details } : {}),
      });
      return;
    }

    this.logger.error(exception);
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: ErrorCode.INTERNAL_ERROR,
      message: errorMessagesFa.INTERNAL_ERROR,
    });
  }
}
