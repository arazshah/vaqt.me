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
import { KvService } from '../kv/kv.service';
import { AuthConfigService } from '../../auth/auth.config';
import type { AuthenticatedRequest } from '../../auth/auth-request';
import { REQUIRED_ROLES_KEY } from '../decorators/roles.decorator';

interface CachedRoleState {
  systemRole: SystemRole;
  mustChangePassword?: boolean;
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
    private readonly kv: KvService,
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

    const cacheKey = this.kv.key('system-role', userId);
    const cached = await this.kv.get(cacheKey);

    let state: CachedRoleState;
    if (cached !== null) {
      state = JSON.parse(cached) as CachedRoleState;
    } else {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { systemRole: true, status: true, mustChangePassword: true },
      });
      if (!user || user.status !== UserStatus.ACTIVE) {
        throw new AppError(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN);
      }
      state = {
        systemRole: user.systemRole,
        mustChangePassword: user.mustChangePassword,
      };
      await this.kv.set(
        cacheKey,
        JSON.stringify(state),
        this.authConfig.verifiedPhoneCacheTtlSeconds,
      );
    }

    if (!requiredRoles.includes(state.systemRole)) {
      throw new AppError(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN);
    }
    // A temporary password opens nothing role-gated until it is replaced.
    if (state.mustChangePassword === true) {
      throw new AppError(
        ErrorCode.PASSWORD_CHANGE_REQUIRED,
        HttpStatus.FORBIDDEN,
      );
    }

    return true;
  }
}
