import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const CODE_LENGTH = 5;
const CODE_MIN = 10 ** (CODE_LENGTH - 1);
const CODE_MAX = 10 ** CODE_LENGTH - 1;
const DUMMY_PHONE = '__no_active_code__';
const DUMMY_CODE = '00000';

@Injectable()
export class OtpService {
  private readonly pepper: string;
  private readonly devFixedOtp?: string;

  constructor(config: ConfigService) {
    const pepper = config.get<string>('OTP_PEPPER');
    if (!pepper) {
      throw new Error('OTP_PEPPER must be set');
    }
    this.pepper = pepper;
    this.devFixedOtp = config.get<string>('DEV_FIXED_OTP');
  }

  generateCode(): string {
    if (this.devFixedOtp && process.env.NODE_ENV !== 'production') {
      return this.devFixedOtp;
    }
    const value =
      CODE_MIN + Math.floor(Math.random() * (CODE_MAX - CODE_MIN + 1));
    return String(value);
  }

  hash(phone: string, code: string): string {
    return createHmac('sha256', this.pepper)
      .update(`${phone}:${code}`)
      .digest('hex');
  }

  /**
   * Constant-time verification. When `storedHash` is null (no active code
   * for this phone), a dummy HMAC is still computed and compared so the
   * response timing doesn't leak whether a code exists — required so
   * /auth/otp/verify can't be used to enumerate phone numbers.
   */
  verify(
    phone: string,
    submittedCode: string,
    storedHash: string | null,
  ): boolean {
    const candidate = this.hash(phone, submittedCode);
    const compareTarget = storedHash ?? this.hash(DUMMY_PHONE, DUMMY_CODE);

    const candidateBuf = Buffer.from(candidate, 'hex');
    const compareBuf = Buffer.from(compareTarget, 'hex');

    const isMatch =
      candidateBuf.length === compareBuf.length &&
      timingSafeEqual(candidateBuf, compareBuf);

    return storedHash !== null && isMatch;
  }
}
