import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

// scrypt (memory-hard) from node:crypto — no native dependency to build.
// Stored as "scrypt$N$r$p$salt$hash" so the cost can be raised later and old
// hashes still verify.
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;
const MAXMEM = 64 * 1024 * 1024;

function derive(
  password: string,
  salt: Buffer,
  n: number,
  r: number,
  p: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize('NFKC'),
      salt,
      KEYLEN,
      { N: n, r, p, maxmem: MAXMEM },
      (err, key) => {
        if (err) reject(err);
        else resolve(key);
      },
    );
  });
}

@Injectable()
export class PasswordService {
  // Verified against when the email is unknown, so "no such user" costs the
  // same time as "wrong password" (no account enumeration by timing).
  private dummyHash: Promise<string> | null = null;

  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const key = await derive(password, salt, N, R, P);
    return [
      'scrypt',
      String(N),
      String(R),
      String(P),
      salt.toString('base64'),
      key.toString('base64'),
    ].join('$');
  }

  async verify(password: string, stored: string | null): Promise<boolean> {
    const hash = stored ?? (await this.getDummy());
    const parts = hash.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const [, n, r, p, salt, key] = parts;
    const expected = Buffer.from(key, 'base64');
    const actual = await derive(
      password,
      Buffer.from(salt, 'base64'),
      Number(n),
      Number(r),
      Number(p),
    );
    const ok =
      expected.length === actual.length && timingSafeEqual(expected, actual);
    return stored !== null && ok;
  }

  private getDummy(): Promise<string> {
    this.dummyHash ??= this.hash(randomBytes(12).toString('hex'));
    return this.dummyHash;
  }
}
