import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

function num(config: ConfigService, key: string, fallback: number): number {
  const raw = config.get<string>(key);
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Every OTP / rate-limit / session threshold, read once from env with a
 * documented default — never hardcoded at the call site.
 */
@Injectable()
export class AuthConfigService {
  readonly otpTtlSeconds: number;
  readonly resendCooldownSeconds: number;
  readonly maxResendPerCode: number;
  readonly maxVerifyAttempts: number;
  readonly phoneHourlyLimit: number;
  readonly phoneDailyLimit: number;
  readonly ipHourlyLimit: number;
  readonly ipDailyLimit: number;
  readonly invalidatedStreakBlockThreshold: number;
  readonly blockSeconds: number;
  readonly accessTokenTtlSeconds: number;
  readonly refreshTokenTtlSeconds: number;
  readonly verifiedPhoneCacheTtlSeconds: number;
  readonly wsTicketTtlSeconds: number;

  constructor(config: ConfigService) {
    this.otpTtlSeconds = num(config, 'OTP_TTL_SECONDS', 120);
    this.resendCooldownSeconds = num(
      config,
      'RATE_LIMIT_RESEND_COOLDOWN_SECONDS',
      60,
    );
    this.maxResendPerCode = num(config, 'RATE_LIMIT_MAX_RESEND_PER_CODE', 3);
    this.maxVerifyAttempts = num(config, 'RATE_LIMIT_MAX_VERIFY_ATTEMPTS', 5);
    this.phoneHourlyLimit = num(config, 'RATE_LIMIT_PHONE_HOURLY', 5);
    this.phoneDailyLimit = num(config, 'RATE_LIMIT_PHONE_DAILY', 10);
    this.ipHourlyLimit = num(config, 'RATE_LIMIT_IP_HOURLY', 15);
    this.ipDailyLimit = num(config, 'RATE_LIMIT_IP_DAILY', 40);
    this.invalidatedStreakBlockThreshold = num(
      config,
      'RATE_LIMIT_INVALIDATED_STREAK_THRESHOLD',
      3,
    );
    this.blockSeconds = num(config, 'RATE_LIMIT_BLOCK_SECONDS', 1800);
    this.accessTokenTtlSeconds = num(config, 'JWT_ACCESS_TTL_SECONDS', 15 * 60);
    this.refreshTokenTtlSeconds = num(
      config,
      'JWT_REFRESH_TTL_SECONDS',
      30 * 24 * 60 * 60,
    );
    this.verifiedPhoneCacheTtlSeconds = num(
      config,
      'VERIFIED_PHONE_CACHE_TTL_SECONDS',
      30,
    );
    this.wsTicketTtlSeconds = num(config, 'WS_TICKET_TTL_SECONDS', 60);
  }
}
