import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { AppError } from '../../common/errors/app-error';
import { ErrorCode } from '../../common/errors/error-codes';
import type { AuthenticatedRequest } from '../auth-request';
import { TokenService } from '../session/token.service';

/**
 * Global and fail-closed: every route requires a valid access token unless
 * explicitly opted out with @Public(). Only checks the JWT's signature and
 * expiry — it does not hit the database, by design (that's what makes a
 * 15-minute access token cheap to verify on every request).
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request);
    if (!token) {
      throw new AppError(ErrorCode.UNAUTHORIZED, HttpStatus.UNAUTHORIZED);
    }

    try {
      request.user = this.tokens.verifyAccessToken(token);
    } catch {
      throw new AppError(ErrorCode.UNAUTHORIZED, HttpStatus.UNAUTHORIZED);
    }

    return true;
  }

  private extractToken(request: AuthenticatedRequest): string | undefined {
    const cookieToken = (request.cookies as Record<string, string> | undefined)
      ?.access_token;
    if (cookieToken) {
      return cookieToken;
    }

    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice('Bearer '.length);
    }

    return undefined;
  }
}
