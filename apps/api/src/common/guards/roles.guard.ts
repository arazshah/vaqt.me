import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { prisma, UserStatus } from '@vaqt/db';
import type { SystemRole } from '@vaqt/shared';
import { AppError } from '../errors/app-error';
import { ErrorCode } from '../errors/error-codes';
import { RedisService } from '../redis/redis.service';
import { AuthConfigService } from '../../auth/auth.config';
import type { AuthenticatedRequest } from '../../auth/auth-request';
import { REQUIRED_ROLES_KEY } from '../decorators/roles.decorator';

interface CachedRoleState {
  systemRole: SystemRole;
}

/**
 * Reads systemRole from the database on every request (never from the
 * JWT), cached in Redis for the same TTL and with the same
 * cache-miss-on-expiry-only invalidation strategy as
 * RequireVerifiedPhoneGuard — no explicit invalidation hook, a role change
 * takes effect within the TTL window.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
    private readonly authConfig: AuthConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<
      SystemRole[] | undefined
    >(REQUIRED_ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.user?.sub;
    if (!userId) {
      throw new AppError(ErrorCode.UNAUTHORIZED, HttpStatus.UNAUTHORIZED);
    }

    const cacheKey = this.redis.key('system-role', userId);
    const cached = await this.redis.client.get(cacheKey);

    let systemRole: SystemRole;
    if (cached !== null) {
      systemRole = (JSON.parse(cached) as CachedRoleState).systemRole;
    } else {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { systemRole: true, status: true },
      });
      if (!user || user.status !== UserStatus.ACTIVE) {
        throw new AppError(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN);
      }
      systemRole = user.systemRole;
      await this.redis.client.set(
        cacheKey,
        JSON.stringify({ systemRole } satisfies CachedRoleState),
        'EX',
        this.authConfig.verifiedPhoneCacheTtlSeconds,
      );
    }

    if (!requiredRoles.includes(systemRole)) {
      throw new AppError(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN);
    }

    return true;
  }
}
