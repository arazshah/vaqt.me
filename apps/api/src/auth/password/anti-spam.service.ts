import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { AppError } from '../../common/errors/app-error';
import { ErrorCode } from '../../common/errors/error-codes';

// A person needs a few seconds to fill the form; a naive bot posts at once.
const MIN_FORM_AGE_MS = 3_000;
const MAX_FORM_AGE_MS = 2 * 60 * 60 * 1000;

// Throwaway-mail domains. Deliberately short: a hand-kept list is a speed
// bump, not a wall — the rate limits are the real defence.
const DISPOSABLE_DOMAINS: ReadonlySet<string> = new Set([
  'mailinator.com',
  'guerrillamail.com',
  '10minutemail.com',
  'tempmail.com',
  'temp-mail.org',
  'yopmail.com',
  'trashmail.com',
  'sharklasers.com',
  'getnada.com',
  'dispostable.com',
  'maildrop.cc',
  'throwawaymail.com',
]);

@Injectable()
export class AntiSpamService {
  private readonly secret: string;

  constructor(config: ConfigService) {
    const secret = config.get<string>('OTP_PEPPER');
    if (!secret) throw new Error('OTP_PEPPER is required');
    this.secret = secret;
  }

  /** Issued when the register form opens; proves "a form was rendered". */
  issueFormToken(now = Date.now()): string {
    const stamp = String(now);
    return `${stamp}.${this.sign(stamp)}`;
  }

  assertHuman(
    input: { formToken: string; website?: string | undefined },
    now = Date.now(),
  ): void {
    if (input.website && input.website.trim() !== '') this.reject();
    const [stamp, sig] = input.formToken.split('.');
    if (!stamp || !sig) this.reject();
    const expected = Buffer.from(this.sign(stamp));
    const given = Buffer.from(sig);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
      this.reject();
    }
    const age = now - Number(stamp);
    if (
      !Number.isFinite(age) ||
      age < MIN_FORM_AGE_MS ||
      age > MAX_FORM_AGE_MS
    ) {
      this.reject();
    }
  }

  assertEmailAllowed(email: string): void {
    const domain = email.split('@')[1] ?? '';
    if (DISPOSABLE_DOMAINS.has(domain)) {
      throw new AppError(ErrorCode.EMAIL_NOT_ALLOWED, HttpStatus.BAD_REQUEST);
    }
  }

  private sign(stamp: string): string {
    return createHmac('sha256', this.secret)
      .update(`register:${stamp}`)
      .digest('base64url');
  }

  private reject(): never {
    throw new AppError(ErrorCode.REGISTRATION_REJECTED, HttpStatus.BAD_REQUEST);
  }
}
