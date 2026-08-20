import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { prisma } from '@vaqt/db';
import { AuthConfigService } from '../auth.config';
import { AuditService } from '../audit/audit.service';
import { TokenService } from './token.service';

export interface DeviceContext {
  userAgent?: string;
  ip?: string;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
}

export class SessionReuseDetectedError extends Error {
  constructor() {
    super('Refresh token reuse detected — session family revoked');
  }
}

export class SessionInvalidError extends Error {
  constructor(reason: string) {
    super(`Invalid session: ${reason}`);
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class SessionService {
  constructor(
    private readonly tokens: TokenService,
    private readonly authConfig: AuthConfigService,
    private readonly audit: AuditService,
  ) {}

  async createSession(
    userId: string,
    device: DeviceContext,
  ): Promise<IssuedTokens> {
    return this.issueNewSessionRow(userId, randomUUID(), device, null);
  }

  /**
   * Verifies + rotates a refresh token. Throws SessionReuseDetectedError if
   * the presented token belongs to a session that was already rotated
   * (revoked) once before — the entire family is revoked and a high
   * severity AuditLog is written before the error propagates.
   */
  async rotateSession(
    refreshToken: string,
    device: DeviceContext,
  ): Promise<IssuedTokens> {
    let payload: { sub: string; sid: string };
    try {
      payload = this.tokens.verifyRefreshToken(refreshToken);
    } catch {
      throw new SessionInvalidError('signature/expiry check failed');
    }

    const session = await prisma.session.findUnique({
      where: { id: payload.sid },
    });
    if (!session || session.userId !== payload.sub) {
      throw new SessionInvalidError('session not found');
    }

    if (session.revokedAt !== null) {
      await this.revokeFamily(session.familyId);
      await this.audit.log({
        actorId: session.userId,
        action: 'auth.session.reuse_detected',
        entityType: 'Session',
        entityId: session.id,
        meta: {
          familyId: session.familyId,
          ip: device.ip,
          userAgent: device.userAgent,
        },
        severity: 'high',
      });
      throw new SessionReuseDetectedError();
    }

    const presentedHash = Buffer.from(hashToken(refreshToken), 'hex');
    const storedHash = Buffer.from(session.refreshTokenHash, 'hex');
    const hashMatches =
      presentedHash.length === storedHash.length &&
      timingSafeEqual(presentedHash, storedHash);

    if (!hashMatches) {
      throw new SessionInvalidError('token hash mismatch');
    }

    if (session.expiresAt.getTime() < Date.now()) {
      throw new SessionInvalidError('session expired');
    }

    return this.issueNewSessionRow(
      session.userId,
      session.familyId,
      device,
      session.id,
    );
  }

  /**
   * Creates a new Session row, signs its access+refresh tokens (which
   * embed the new row's id), then writes the token hash back. The
   * create-then-update round trip is unavoidable: the JWT payload needs
   * the session id, which only exists after the row is created. When
   * `supersedes` is set, that old session is atomically revoked in the
   * same transaction as the hash write.
   */
  private async issueNewSessionRow(
    userId: string,
    familyId: string,
    device: DeviceContext,
    supersedes: string | null,
  ): Promise<IssuedTokens> {
    const session = await prisma.session.create({
      data: {
        userId,
        familyId,
        refreshTokenHash: randomUUID(),
        userAgent: device.userAgent,
        ip: device.ip,
        expiresAt: new Date(
          Date.now() + this.authConfig.refreshTokenTtlSeconds * 1000,
        ),
      },
    });

    const accessToken = this.tokens.signAccessToken({
      sub: userId,
      sid: session.id,
    });
    const refreshToken = this.tokens.signRefreshToken({
      sub: userId,
      sid: session.id,
    });

    await prisma.$transaction([
      prisma.session.update({
        where: { id: session.id },
        data: { refreshTokenHash: hashToken(refreshToken) },
      }),
      ...(supersedes
        ? [
            prisma.session.update({
              where: { id: supersedes },
              data: { revokedAt: new Date(), replacedById: session.id },
            }),
          ]
        : []),
    ]);

    return { accessToken, refreshToken };
  }

  async revokeSession(sessionId: string): Promise<void> {
    await prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeFamily(familyId: string): Promise<void> {
    await prisma.session.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllSessionsForUser(userId: string): Promise<void> {
    await prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
