import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthConfigService } from '../auth.config';

export interface AccessTokenPayload {
  sub: string;
  sid: string;
}

@Injectable()
export class TokenService {
  private readonly accessSecret: string;
  private readonly refreshSecret: string;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService,
    private readonly authConfig: AuthConfigService,
  ) {
    const accessSecret = config.get<string>('JWT_ACCESS_SECRET');
    const refreshSecret = config.get<string>('JWT_REFRESH_SECRET');
    if (!accessSecret || !refreshSecret) {
      throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be set');
    }
    this.accessSecret = accessSecret;
    this.refreshSecret = refreshSecret;
  }

  signAccessToken(payload: AccessTokenPayload): string {
    return this.jwt.sign(payload, {
      secret: this.accessSecret,
      expiresIn: this.authConfig.accessTokenTtlSeconds,
    });
  }

  signRefreshToken(payload: AccessTokenPayload): string {
    return this.jwt.sign(payload, {
      secret: this.refreshSecret,
      expiresIn: this.authConfig.refreshTokenTtlSeconds,
    });
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    return this.jwt.verify<AccessTokenPayload>(token, {
      secret: this.accessSecret,
    });
  }

  verifyRefreshToken(token: string): AccessTokenPayload {
    return this.jwt.verify<AccessTokenPayload>(token, {
      secret: this.refreshSecret,
    });
  }
}
