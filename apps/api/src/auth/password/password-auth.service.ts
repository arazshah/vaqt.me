import { HttpStatus, Injectable } from '@nestjs/common';
import { prisma, Prisma, type User } from '@vaqt/db';
import type {
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
} from '@vaqt/shared';
import { AppError } from '../../common/errors/app-error';
import { ErrorCode } from '../../common/errors/error-codes';
import { KvService } from '../../common/kv/kv.service';
import { AuditService } from '../audit/audit.service';
import { AuthConfigService } from '../auth.config';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import type { DeviceContext } from '../session/session.service';
import { SessionService } from '../session/session.service';
import type { IssuedTokens } from '../session/session.service';
import { AntiSpamService } from './anti-spam.service';
import { PasswordService } from './password.service';

// Per-IP caps on creating accounts, and per-IP / per-email caps on guessing
// passwords. Every attempt counts, accepted or not.
const LOGIN_PER_IP_WINDOW = 30;
const LOGIN_PER_EMAIL_WINDOW = 10;
const LOGIN_WINDOW_SECONDS = 15 * 60;

export interface PasswordAuthResult {
  user: User;
  tokens: IssuedTokens;
}

@Injectable()
export class PasswordAuthService {
  constructor(
    private readonly passwords: PasswordService,
    private readonly antiSpam: AntiSpamService,
    private readonly rateLimit: RateLimitService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
    private readonly config: AuthConfigService,
    private readonly kv: KvService,
  ) {}

  async register(
    input: RegisterInput,
    device: DeviceContext,
  ): Promise<PasswordAuthResult> {
    const ip = device.ip ?? 'unknown';
    this.antiSpam.assertHuman(input);

    const hour = await this.rateLimit.checkSlidingWindow(
      'register-ip-hour',
      ip,
      this.config.registerIpHourlyLimit,
      3600,
    );
    const day = await this.rateLimit.checkSlidingWindow(
      'register-ip-day',
      ip,
      this.config.registerIpDailyLimit,
      86_400,
    );
    for (const w of [hour, day]) {
      if (!w.allowed) {
        throw new AppError(
          ErrorCode.TOO_MANY_ATTEMPTS,
          HttpStatus.TOO_MANY_REQUESTS,
          { retryAfterSeconds: w.retryAfterSeconds },
        );
      }
    }

    this.antiSpam.assertEmailAllowed(input.email);

    const passwordHash = await this.passwords.hash(input.password);
    const now = new Date();
    let user;
    try {
      user = await prisma.user.create({
        data: {
          email: input.email,
          passwordHash,
          displayName: input.displayName ?? input.email.split('@')[0],
          lastSeenAt: now,
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new AppError(ErrorCode.EMAIL_TAKEN, HttpStatus.CONFLICT);
      }
      throw err;
    }

    const tokens = await this.sessions.createSession(user.id, device);
    await this.audit.log({
      actorId: user.id,
      action: 'auth.register.success',
      entityType: 'User',
      entityId: user.id,
      meta: { ip },
    });
    return { user, tokens };
  }

  async login(
    input: LoginInput,
    device: DeviceContext,
  ): Promise<PasswordAuthResult> {
    const ip = device.ip ?? 'unknown';
    const byIp = await this.rateLimit.checkSlidingWindow(
      'login-ip',
      ip,
      LOGIN_PER_IP_WINDOW,
      LOGIN_WINDOW_SECONDS,
    );
    const byEmail = await this.rateLimit.checkSlidingWindow(
      'login-email',
      input.email,
      LOGIN_PER_EMAIL_WINDOW,
      LOGIN_WINDOW_SECONDS,
    );
    for (const w of [byIp, byEmail]) {
      if (!w.allowed) {
        throw new AppError(
          ErrorCode.TOO_MANY_ATTEMPTS,
          HttpStatus.TOO_MANY_REQUESTS,
          { retryAfterSeconds: w.retryAfterSeconds },
        );
      }
    }

    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });
    const ok = await this.passwords.verify(
      input.password,
      user?.passwordHash ?? null,
    );
    if (!user || !ok || user.status !== 'ACTIVE') {
      await this.audit.log({
        actorId: user?.id ?? null,
        action: 'auth.login.failed',
        entityType: 'User',
        entityId: user?.id ?? 'unknown',
        meta: { ip, method: 'password' },
      });
      throw new AppError(
        ErrorCode.INVALID_CREDENTIALS,
        HttpStatus.UNAUTHORIZED,
      );
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date() },
    });
    const tokens = await this.sessions.createSession(user.id, device);
    await this.audit.log({
      actorId: user.id,
      action: 'auth.login.success',
      entityType: 'User',
      entityId: user.id,
      meta: { ip, method: 'password' },
    });
    return { user: updated, tokens };
  }

  /**
   * Replaces the caller's password after checking the current one. Clears
   * mustChangePassword (the built-in admin's temporary password) and signs
   * out every other session of this account.
   */
  async changePassword(
    userId: string,
    sessionId: string,
    input: ChangePasswordInput,
  ): Promise<User> {
    const window = await this.rateLimit.checkSlidingWindow(
      'password-change',
      userId,
      LOGIN_PER_EMAIL_WINDOW,
      LOGIN_WINDOW_SECONDS,
    );
    if (!window.allowed) {
      throw new AppError(
        ErrorCode.TOO_MANY_ATTEMPTS,
        HttpStatus.TOO_MANY_REQUESTS,
        { retryAfterSeconds: window.retryAfterSeconds },
      );
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const ok = await this.passwords.verify(
      input.currentPassword,
      user?.passwordHash ?? null,
    );
    if (!user || !ok) {
      throw new AppError(ErrorCode.WRONG_PASSWORD, HttpStatus.BAD_REQUEST);
    }
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await this.passwords.hash(input.newPassword),
        mustChangePassword: false,
      },
    });
    await prisma.session.updateMany({
      where: { userId, revokedAt: null, id: { not: sessionId } },
      data: { revokedAt: new Date() },
    });
    // RolesGuard caches the role state; drop it so admin access opens now.
    await this.kv.del(this.kv.key('system-role', userId));
    await this.audit.log({
      actorId: userId,
      action: 'auth.password.changed',
      entityType: 'User',
      entityId: userId,
      severity: 'high',
    });
    return updated;
  }
}
