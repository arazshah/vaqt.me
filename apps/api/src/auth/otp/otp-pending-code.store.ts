import { Injectable } from '@nestjs/common';
import { KvService } from '../../common/kv/kv.service';

/**
 * Postgres only ever stores the HMAC hash of an OTP code (see OtpService) —
 * it never stores the plaintext. But "resend" must deliver the exact same
 * code the user already partially typed, without changing expiresAt. The
 * only place that can live in the meantime is a short-lived Redis entry
 * scoped to the current code's remaining validity window; it is never
 * consulted for verification (Postgres + HMAC remains the sole source of
 * truth there), only to know what to re-send.
 */
@Injectable()
export class OtpPendingCodeStore {
  constructor(private readonly kv: KvService) {}

  private key(phone: string): string {
    return this.kv.key('otp', 'pending-code', phone);
  }

  async set(phone: string, code: string, ttlSeconds: number): Promise<void> {
    if (ttlSeconds <= 0) {
      return;
    }
    await this.kv.set(this.key(phone), code, ttlSeconds);
  }

  async get(phone: string): Promise<string | null> {
    return this.kv.get(this.key(phone));
  }

  async clear(phone: string): Promise<void> {
    await this.kv.del(this.key(phone));
  }
}
