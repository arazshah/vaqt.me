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

interface NestValidationBody {
  message?: string | string[];
}

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
      const details =
        typeof body === 'object'
          ? (body as NestValidationBody).message
          : undefined;

      response.status(status).json({
        code: ErrorCode.VALIDATION_ERROR,
        message: errorMessagesFa.VALIDATION_ERROR,
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
