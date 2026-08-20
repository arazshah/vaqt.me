import type { NextFunction, Request, Response } from 'express';
import { ErrorCode } from '../errors/error-codes';
import { errorMessagesFa } from '../messages/fa';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Defense-in-depth complement to SameSite=Lax cookies (not a replacement,
 * and not a full CSRF-token scheme): every mutating request's Origin
 * (falling back to Referer) must exactly match the configured web origin,
 * or it's rejected before reaching any route handler. Writes the response
 * directly (matching AppError's { code, message } shape) rather than
 * throwing, since this runs as raw Express middleware ahead of Nest's own
 * exception-filter pipeline.
 */
export function createOriginCheckMiddleware(webOrigin: string) {
  return function originCheckMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    if (!MUTATING_METHODS.has(req.method)) {
      next();
      return;
    }

    const origin = req.headers.origin;
    const referer = req.headers.referer;
    let candidate: string | undefined = origin;
    if (!candidate && referer) {
      try {
        candidate = new URL(referer).origin;
      } catch {
        candidate = undefined;
      }
    }

    if (candidate !== webOrigin) {
      res.status(403).json({
        code: ErrorCode.FORBIDDEN,
        message: errorMessagesFa.FORBIDDEN,
      });
      return;
    }

    next();
  };
}
