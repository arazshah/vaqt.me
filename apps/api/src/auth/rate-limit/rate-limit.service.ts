import { Injectable } from '@nestjs/common';
import { KvService } from '../../common/kv/kv.service';
import { AuthConfigService } from '../auth.config';

export interface SlidingWindowResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export interface InvalidatedStreakResult {
  blocked: boolean;
  retryAfterSeconds?: number;
}

const STREAK_KEY_TTL_SECONDS = 24 * 60 * 60;

@Injectable()
export class RateLimitService {
  constructor(
    private readonly kv: KvService,
    private readonly config: AuthConfigService,
  ) {}

  /**
   * Every call to a window counts as one request, accepted or not — a
   * rejected attempt still occupies a slot, so hammering the endpoint
   * can't dodge the limit by design.
   */
  async checkSlidingWindow(
    scope: string,
    identifier: string,
    limit: number,
    windowSeconds: number,
    now = Date.now(),
  ): Promise<SlidingWindowResult> {
    const key = this.kv.key('ratelimit', scope, identifier);
    const windowMs = windowSeconds * 1000;

    const [allowed, retryAfterSeconds] = await this.kv.slidingWindow(
      key,
      now,
      windowMs,
      limit,
    );

    return { allowed, retryAfterSeconds };
  }

  async checkResendCooldown(
    phone: string,
    now?: number,
  ): Promise<SlidingWindowResult> {
    return this.checkSlidingWindow(
      'otp-resend',
      phone,
      1,
      this.config.resendCooldownSeconds,
      now,
    );
  }

  async checkPhoneRequestLimits(
    phone: string,
    now?: number,
  ): Promise<SlidingWindowResult> {
    const hourly = await this.checkSlidingWindow(
      'otp-phone-hour',
      phone,
      this.config.phoneHourlyLimit,
      3600,
      now,
    );
    if (!hourly.allowed) {
      return hourly;
    }
    return this.checkSlidingWindow(
      'otp-phone-day',
      phone,
      this.config.phoneDailyLimit,
      86400,
      now,
    );
  }

  async checkIpRequestLimits(
    ip: string,
    now?: number,
  ): Promise<SlidingWindowResult> {
    const hourly = await this.checkSlidingWindow(
      'otp-ip-hour',
      ip,
      this.config.ipHourlyLimit,
      3600,
      now,
    );
    if (!hourly.allowed) {
      return hourly;
    }
    return this.checkSlidingWindow(
      'otp-ip-day',
      ip,
      this.config.ipDailyLimit,
      86400,
      now,
    );
  }

  async recordInvalidatedCode(phone: string): Promise<InvalidatedStreakResult> {
    const streakKey = this.kv.key('otp', 'invalidated-streak', phone);
    const streak = await this.kv.increment(
      streakKey,
      STREAK_KEY_TTL_SECONDS,
      true,
    );

    if (streak >= this.config.invalidatedStreakBlockThreshold) {
      await this.kv.del(streakKey);
      const blockKey = this.kv.key('otp', 'blocked', phone);
      await this.kv.set(blockKey, '1', this.config.blockSeconds);
      return { blocked: true, retryAfterSeconds: this.config.blockSeconds };
    }

    return { blocked: false };
  }

  async clearInvalidatedStreak(phone: string): Promise<void> {
    await this.kv.del(this.kv.key('otp', 'invalidated-streak', phone));
  }

  async getPhoneBlockRetryAfterSeconds(phone: string): Promise<number | null> {
    const ttl = await this.kv.ttl(this.kv.key('otp', 'blocked', phone));
    return ttl > 0 ? ttl : null;
  }
}
