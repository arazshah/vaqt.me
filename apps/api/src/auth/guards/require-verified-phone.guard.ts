import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { prisma, UserStatus } from '@vaqt/db';
import { AppError } from '../../common/errors/app-error';
import { ErrorCode } from '../../common/errors/error-codes';
import { RedisService } from '../../common/redis/redis.service';
import { AuthConfigService } from '../auth.config';
import type { AuthenticatedRequest } from '../auth-request';

interface CachedVerificationState {
  verified: boolean;
}

/**
 * Reads phoneVerifiedAt + block status from the database on every request
 * (never from the JWT, which is intentionally minimal) so that revoking a
 * user's verification takes effect within the cache TTL instead of waiting
 * for their 15-minute access token to expire. Cached in Redis for
 * authConfig.verifiedPhoneCacheTtlSeconds to keep the DB hit cheap.
 */
@Injectable()
export class RequireVerifiedPhoneGuard implements CanActivate {
  constructor(
    private readonly redis: RedisService,
    private readonly authConfig: AuthConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.user?.sub;
    if (!userId) {
      throw new AppError(ErrorCode.UNAUTHORIZED, HttpStatus.UNAUTHORIZED);
    }

    const cacheKey = this.redis.key('verified-phone', userId);
    const cached = await this.redis.client.get(cacheKey);

    let verified: boolean;
    if (cached !== null) {
      verified = (JSON.parse(cached) as CachedVerificationState).verified;
    } else {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { phoneVerifiedAt: true, status: true },
      });
      verified =
        !!user &&
        user.phoneVerifiedAt !== null &&
        user.status === UserStatus.ACTIVE;
      await this.redis.client.set(
        cacheKey,
        JSON.stringify({ verified } satisfies CachedVerificationState),
        'EX',
        this.authConfig.verifiedPhoneCacheTtlSeconds,
      );
    }

    if (!verified) {
      throw new AppError(ErrorCode.PHONE_NOT_VERIFIED, HttpStatus.FORBIDDEN);
    }

    return true;
  }
}
