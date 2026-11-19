import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import {
  HttpStatus,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { prisma } from '@vaqt/db';
import { normalizePhone, type SetupClaimInput } from '@vaqt/shared';
import { AuditService } from '../auth/audit/audit.service';
import type {
  DeviceContext,
  SessionService,
} from '../auth/session/session.service';
import { AppError } from '../common/errors/app-error';
import { ErrorCode } from '../common/errors/error-codes';
import { RedisService } from '../common/redis/redis.service';
import { maskPhone } from '../common/utils/mask-phone';

const ATTEMPTS_PER_HOUR = 10;
// Arbitrary constant: serialises concurrent claims on one Postgres advisory lock.
const CLAIM_LOCK_ID = 7_410_001;

const sha256 = (v: string) => createHash('sha256').update(v).digest();

/**
 * First-run admin setup without any pre-set credentials.
 *
 * While the system has no admin, each boot prints a one-time token in the
 * server log (which only whoever operates the server can read). Presenting it
 * together with a phone number makes that number the first admin and logs it
 * in directly, so the admin can open the panel and configure SMS before any
 * SMS login is possible. Once an admin exists the whole thing is inert.
 */
@Injectable()
export class AdminSetupService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminSetupService.name);
  // Only the hash lives in memory, and it dies with the process: restarting
  // the server issues a fresh token and invalidates the old one.
  private tokenHash: Buffer | null = null;

  constructor(
    private readonly redis: RedisService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  async needsSetup(): Promise<boolean> {
    return (await prisma.user.count({ where: { systemRole: 'ADMIN' } })) === 0;
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!(await this.needsSetup())) return;
    const token = this.issueToken();
    const origin =
      this.config.get<string>('WEB_ORIGIN') ?? 'http://localhost:3000';
    this.logger.warn(
      [
        '',
        '================ FIRST-RUN ADMIN SETUP ================',
        `  Open:  ${origin}/admin/setup`,
        `  ADMIN SETUP TOKEN: ${token}`,
        '  (valid until the server restarts; no admin exists yet)',
        '=======================================================',
      ].join('\n'),
    );
  }

  /** Visible for tests. */
  issueToken(): string {
    const token = randomBytes(24).toString('base64url');
    this.tokenHash = sha256(token);
    return token;
  }

  async claim(
    input: SetupClaimInput,
    device: DeviceContext,
    sessions: SessionService,
  ) {
    const ip = device.ip ?? 'unknown';
    const key = this.redis.key(
      'admin-setup-attempts',
      createHash('sha256').update(ip).digest('hex').slice(0, 16),
    );
    const attempts = await this.redis.client.incr(key);
    if (attempts === 1) await this.redis.client.expire(key, 3600);
    if (attempts > ATTEMPTS_PER_HOUR) {
      throw new AppError(
        ErrorCode.TOO_MANY_ATTEMPTS,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Once an admin exists this looks like a route that isn't there.
    if (!(await this.needsSetup())) {
      throw new AppError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    if (
      !this.tokenHash ||
      !timingSafeEqual(sha256(input.token), this.tokenHash)
    ) {
      throw new AppError(ErrorCode.SETUP_TOKEN_INVALID, HttpStatus.FORBIDDEN);
    }
    const phone = normalizePhone(input.phone);
    if (!phone) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, HttpStatus.BAD_REQUEST);
    }

    const now = new Date();
    const user = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CLAIM_LOCK_ID})`;
      // Re-check inside the lock: two simultaneous claims must not both win.
      if ((await tx.user.count({ where: { systemRole: 'ADMIN' } })) > 0) {
        throw new AppError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
      }
      const displayName = input.displayName ?? 'مدیر';
      return tx.user.upsert({
        where: { phone },
        create: {
          phone,
          displayName,
          systemRole: 'ADMIN',
          phoneVerifiedAt: now,
          lastSeenAt: now,
        },
        update: { systemRole: 'ADMIN', phoneVerifiedAt: now, lastSeenAt: now },
      });
    });
    this.tokenHash = null; // single use

    await this.audit.log({
      actorId: user.id,
      action: 'admin.setup.claimed',
      entityType: 'User',
      entityId: user.id,
      severity: 'high',
      meta: { phone: maskPhone(phone), ip },
    });
    this.logger.warn(`first admin created: ${maskPhone(phone)}`);

    const tokens = await sessions.createSession(user.id, device);
    return { tokens, userId: user.id };
  }
}
