import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AppError } from '../../common/errors/app-error';
import { ErrorCode } from '../../common/errors/error-codes';
import type { AuthenticatedRequest } from '../auth-request';
import {
  OWNERSHIP_RESOLVER_KEY,
  type OwnershipResolver,
} from '../decorators/require-ownership.decorator';

/**
 * Generic ownership check for future phases: resolves the owning user id
 * for the current request's resource (via whatever @RequireOwnership()
 * was configured with) and compares it against the authenticated user.
 * Resource-not-found and not-owned are deliberately distinguished (404 vs
 * 403) so a caller can't use this guard to probe for resource existence
 * they don't own.
 */
@Injectable()
export class RequireOwnershipGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const resolver = this.reflector.get<OwnershipResolver | undefined>(
      OWNERSHIP_RESOLVER_KEY,
      context.getHandler(),
    );
    if (!resolver) {
      throw new Error(
        '@RequireOwnership() guard active without a resolver — did you forget the decorator argument?',
      );
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.user?.sub;
    if (!userId) {
      throw new AppError(ErrorCode.UNAUTHORIZED, HttpStatus.UNAUTHORIZED);
    }

    const ownerId = await resolver(request);
    if (ownerId === null) {
      throw new AppError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    if (ownerId !== userId) {
      throw new AppError(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN);
    }

    return true;
  }
}
