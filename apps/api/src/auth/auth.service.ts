import { randomUUID } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { prisma, OtpPurpose } from '@vaqt/db';
import { normalizePhone, toPersianDigits, RoleIntent } from '@vaqt/shared';
import { AppError } from '../common/errors/app-error';
import { ErrorCode } from '../common/errors/error-codes';
import { RedisService } from '../common/redis/redis.service';
import { maskPhone } from '../common/utils/mask-phone';
import { AuthConfigService } from './auth.config';
import { AuditService } from './audit/audit.service';
import { OtpService } from './otp/otp.service';
import { OtpPendingCodeStore } from './otp/otp-pending-code.store';
import { RateLimitService } from './rate-limit/rate-limit.service';
import {
  SessionInvalidError,
  SessionReuseDetectedError,
  SessionService,
  type DeviceContext,
  type IssuedTokens,
} from './session/session.service';
import { SmsQueueService } from './sms/sms-queue.service';
import { toPublicUser, type PublicUser } from './user-view';

export interface OtpRequestResult {
  ok: true;
  expiresIn: number;
  resendAfter: number;
}

export interface VerifyOtpResult {
  user: PublicUser;
  tokens: IssuedTokens;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly otp: OtpService,
    private readonly rateLimit: RateLimitService,
    private readonly pendingCode: OtpPendingCodeStore,
    private readonly smsQueue: SmsQueueService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
    private readonly config: AuthConfigService,
    private readonly redis: RedisService,
  ) {}

  async requestOtp(rawPhone: string, ip: string): Promise<OtpRequestResult> {
    const phone = this.requirePhone(rawPhone);
    await this.assertNotBlocked(phone);

    const resend = await this.rateLimit.checkResendCooldown(phone);
    this.assertAllowed(resend);
    const phoneLimits = await this.rateLimit.checkPhoneRequestLimits(phone);
    this.assertAllowed(phoneLimits);
    const ipLimits = await this.rateLimit.checkIpRequestLimits(ip);
    this.assertAllowed(ipLimits);

    const now = new Date();
    const existing = await prisma.verificationCode.findFirst({
      where: {
        phone,
        purpose: OtpPurpose.AUTH,
        consumedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
    });

    let code: string;
    let expiresAt: Date;

    if (existing) {
      if (existing.sendCount >= this.config.maxResendPerCode) {
        throw new AppError(
          ErrorCode.OTP_RATE_LIMITED,
          HttpStatus.TOO_MANY_REQUESTS,
          {
            details: { reason: 'MAX_RESEND_EXCEEDED' },
          },
        );
      }

      expiresAt = existing.expiresAt;
      const cached = await this.pendingCode.get(phone);
      if (cached) {
        code = cached;
      } else {
        // Redis lost the pending plaintext (e.g. restart) — the code is
        // unrecoverable from its hash, so a fresh one is issued for the
        // same row without extending expiresAt.
        code = this.otp.generateCode();
        await prisma.verificationCode.update({
          where: { id: existing.id },
          data: { codeHash: this.otp.hash(phone, code) },
        });
      }

      await prisma.verificationCode.update({
        where: { id: existing.id },
        data: { sendCount: { increment: 1 } },
      });
    } else {
      code = this.otp.generateCode();
      expiresAt = new Date(now.getTime() + this.config.otpTtlSeconds * 1000);
      await prisma.verificationCode.create({
        data: {
          phone,
          purpose: OtpPurpose.AUTH,
          codeHash: this.otp.hash(phone, code),
          expiresAt,
          ip,
          sendCount: 1,
        },
      });
    }

    const expiresIn = Math.max(
      1,
      Math.ceil((expiresAt.getTime() - now.getTime()) / 1000),
    );
    await this.pendingCode.set(phone, code, expiresIn);
    await this.smsQueue.enqueueOtp({ phone, code });

    return {
      ok: true,
      expiresIn,
      resendAfter: this.config.resendCooldownSeconds,
    };
  }

  async verifyOtp(
    rawPhone: string,
    submittedCode: string,
    device: DeviceContext,
  ): Promise<VerifyOtpResult> {
    const phone = this.requirePhone(rawPhone);
    await this.assertNotBlocked(phone);

    const now = new Date();
    const row = await prisma.verificationCode.findFirst({
      where: { phone, purpose: OtpPurpose.AUTH, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!row) {
      this.otp.verify(phone, submittedCode, null);
      throw new AppError(ErrorCode.OTP_INVALID, HttpStatus.BAD_REQUEST);
    }

    if (row.expiresAt.getTime() <= now.getTime()) {
      this.otp.verify(phone, submittedCode, row.codeHash);
      throw new AppError(ErrorCode.OTP_EXPIRED, HttpStatus.BAD_REQUEST);
    }

    const isValid = this.otp.verify(phone, submittedCode, row.codeHash);

    if (!isValid) {
      await this.handleFailedAttempt(phone, row.id, row.attempts);
    }

    await prisma.verificationCode.update({
      where: { id: row.id },
      data: { consumedAt: now },
    });
    await this.pendingCode.clear(phone);
    await this.rateLimit.clearInvalidatedStreak(phone);

    const user = await this.findOrCreateVerifiedUser(phone, now);
    const tokens = await this.sessions.createSession(user.id, device);

    await this.audit.log({
      actorId: user.id,
      action: 'auth.login.success',
      entityType: 'User',
      entityId: user.id,
      meta: { phone: maskPhone(phone), ip: device.ip },
    });

    return { user: toPublicUser(user), tokens };
  }

  async refresh(
    refreshToken: string,
    device: DeviceContext,
  ): Promise<IssuedTokens> {
    try {
      return await this.sessions.rotateSession(refreshToken, device);
    } catch (error) {
      if (error instanceof SessionReuseDetectedError) {
        throw new AppError(
          ErrorCode.SESSION_REUSE_DETECTED,
          HttpStatus.UNAUTHORIZED,
        );
      }
      if (error instanceof SessionInvalidError) {
        throw new AppError(ErrorCode.SESSION_INVALID, HttpStatus.UNAUTHORIZED);
      }
      throw error;
    }
  }

  async logout(userId: string, sessionId: string): Promise<void> {
    await this.sessions.revokeSession(sessionId);
    await this.audit.log({
      actorId: userId,
      action: 'auth.logout',
      entityType: 'Session',
      entityId: sessionId,
    });
  }

  async logoutAll(userId: string): Promise<void> {
    await this.sessions.revokeAllSessionsForUser(userId);
    await this.audit.log({ actorId: userId, action: 'auth.logout_all' });
  }

  async getMe(userId: string): Promise<PublicUser> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError(ErrorCode.UNAUTHORIZED, HttpStatus.UNAUTHORIZED);
    }
    return toPublicUser(user);
  }

  async updateRole(
    userId: string,
    roleIntent: RoleIntent,
  ): Promise<PublicUser> {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { roleIntent },
    });
    return toPublicUser(user);
  }

  async createWsTicket(
    userId: string,
  ): Promise<{ ticket: string; expiresIn: number }> {
    const ticket = randomUUID();
    const expiresIn = this.config.wsTicketTtlSeconds;
    await this.redis.client.set(
      this.redis.key('ws-ticket', ticket),
      userId,
      'EX',
      expiresIn,
    );
    return { ticket, expiresIn };
  }

  private requirePhone(rawPhone: string): string {
    const phone = normalizePhone(rawPhone);
    if (!phone) {
      throw new AppError(ErrorCode.PHONE_INVALID, HttpStatus.BAD_REQUEST);
    }
    return phone;
  }

  private async assertNotBlocked(phone: string): Promise<void> {
    const retryAfterSeconds =
      await this.rateLimit.getPhoneBlockRetryAfterSeconds(phone);
    if (retryAfterSeconds !== null) {
      throw new AppError(
        ErrorCode.PHONE_BLOCKED,
        HttpStatus.TOO_MANY_REQUESTS,
        {
          retryAfterSeconds,
        },
      );
    }
  }

  private assertAllowed(result: {
    allowed: boolean;
    retryAfterSeconds: number;
  }): void {
    if (!result.allowed) {
      throw new AppError(
        ErrorCode.OTP_RATE_LIMITED,
        HttpStatus.TOO_MANY_REQUESTS,
        {
          retryAfterSeconds: result.retryAfterSeconds,
        },
      );
    }
  }

  private async handleFailedAttempt(
    phone: string,
    verificationCodeId: string,
    previousAttempts: number,
  ): Promise<never> {
    const attempts = previousAttempts + 1;

    if (attempts >= this.config.maxVerifyAttempts) {
      await prisma.verificationCode.update({
        where: { id: verificationCodeId },
        data: { attempts, consumedAt: new Date() },
      });
      await this.pendingCode.clear(phone);
      await this.audit.log({
        actorId: null,
        action: 'auth.otp.verify_failed_max_attempts',
        meta: { phone: maskPhone(phone) },
      });

      const streak = await this.rateLimit.recordInvalidatedCode(phone);
      if (streak.blocked) {
        await this.audit.log({
          actorId: null,
          action: 'auth.phone.blocked',
          meta: { phone: maskPhone(phone) },
          severity: 'high',
        });
        throw new AppError(
          ErrorCode.PHONE_BLOCKED,
          HttpStatus.TOO_MANY_REQUESTS,
          {
            retryAfterSeconds: streak.retryAfterSeconds,
          },
        );
      }

      throw new AppError(ErrorCode.OTP_INVALID, HttpStatus.BAD_REQUEST);
    }

    await prisma.verificationCode.update({
      where: { id: verificationCodeId },
      data: { attempts },
    });
    await this.audit.log({
      actorId: null,
      action: 'auth.otp.verify_failed',
      meta: { phone: maskPhone(phone) },
    });

    throw new AppError(ErrorCode.OTP_INVALID, HttpStatus.BAD_REQUEST, {
      details: { attemptsRemaining: this.config.maxVerifyAttempts - attempts },
    });
  }

  private async findOrCreateVerifiedUser(phone: string, now: Date) {
    const existing = await prisma.user.findUnique({ where: { phone } });
    if (!existing) {
      return prisma.user.create({
        data: {
          phone,
          displayName: `کاربر ${toPersianDigits(phone.slice(-4))}`,
          phoneVerifiedAt: now,
          lastSeenAt: now,
        },
      });
    }
    return prisma.user.update({
      where: { id: existing.id },
      data: {
        phoneVerifiedAt: existing.phoneVerifiedAt ?? now,
        lastSeenAt: now,
      },
    });
  }
}
