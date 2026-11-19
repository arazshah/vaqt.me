import { decryptSecret, encryptSecret } from './settings-crypto';

const MASTER = 'm'.repeat(40);

describe('settings crypto', () => {
  it('round-trips, including non-ASCII values', () => {
    for (const v of ['abc123', 'توکن-فارسی ✓', 'x'.repeat(500)]) {
      expect(decryptSecret(encryptSecret(v, MASTER), MASTER)).toBe(v);
    }
  });

  it('never stores the plaintext and uses a fresh IV every time', () => {
    const a = encryptSecret('super-secret', MASTER);
    const b = encryptSecret('super-secret', MASTER);
    expect(a).not.toContain('super-secret');
    expect(a.startsWith('v1:')).toBe(true);
    expect(a).not.toBe(b);
  });

  it('returns null for a wrong master secret, tampering, or garbage', () => {
    const stored = encryptSecret('super-secret', MASTER);
    expect(decryptSecret(stored, 'n'.repeat(40))).toBeNull();
    const raw = Buffer.from(stored.slice(3), 'base64');
    raw[raw.length - 1] ^= 1;
    expect(decryptSecret('v1:' + raw.toString('base64'), MASTER)).toBeNull();
    expect(decryptSecret('plain-text', MASTER)).toBeNull();
    expect(decryptSecret('v1:', MASTER)).toBeNull();
  });
});
