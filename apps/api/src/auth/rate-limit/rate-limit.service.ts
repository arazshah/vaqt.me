import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { RedisService } from '../../common/redis/redis.service';
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
    private readonly redis: RedisService,
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
    const key = this.redis.key('ratelimit', scope, identifier);
    const windowStartMs = now - windowSeconds * 1000;
    const member = `${String(now)}:${randomUUID()}`;
    const client = this.redis.client;

    await client.zremrangebyscore(key, 0, windowStartMs);
    await client.zadd(key, now, member);
    const count = await client.zcard(key);
    await client.expire(key, windowSeconds);

    if (count <= limit) {
      return { allowed: true, retryAfterSeconds: 0 };
    }

    const oldest = await client.zrange(key, 0, '0', 'WITHSCORES');
    const oldestScore = oldest.length >= 2 ? Number(oldest[1]) : now;
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((oldestScore + windowSeconds * 1000 - now) / 1000),
    );
    return { allowed: false, retryAfterSeconds };
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
    const streakKey = this.redis.key('otp', 'invalidated-streak', phone);
    const streak = await this.redis.client.incr(streakKey);
    await this.redis.client.expire(streakKey, STREAK_KEY_TTL_SECONDS);

    if (streak >= this.config.invalidatedStreakBlockThreshold) {
      await this.redis.client.del(streakKey);
      const blockKey = this.redis.key('otp', 'blocked', phone);
      await this.redis.client.set(
        blockKey,
        '1',
        'EX',
        this.config.blockSeconds,
      );
      return { blocked: true, retryAfterSeconds: this.config.blockSeconds };
    }

    return { blocked: false };
  }

  async clearInvalidatedStreak(phone: string): Promise<void> {
    await this.redis.client.del(
      this.redis.key('otp', 'invalidated-streak', phone),
    );
  }

  async getPhoneBlockRetryAfterSeconds(phone: string): Promise<number | null> {
    const ttl = await this.redis.client.ttl(
      this.redis.key('otp', 'blocked', phone),
    );
    return ttl > 0 ? ttl : null;
  }
}
