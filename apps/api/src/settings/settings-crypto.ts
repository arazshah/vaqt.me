import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from 'crypto';

const PREFIX = 'v1:';
const IV_BYTES = 12;
const TAG_BYTES = 16;

function key(masterSecret: string): Buffer {
  return Buffer.from(
    hkdfSync('sha256', masterSecret, 'vaqt-settings', 'secret-values-v1', 32),
  );
}

/** AES-256-GCM; output "v1:" + base64(iv | tag | ciphertext). */
export function encryptSecret(plain: string, masterSecret: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key(masterSecret), iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return (
    PREFIX + Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64')
  );
}

/** Returns null (never throws) if the value was tampered with or the master secret changed. */
export function decryptSecret(
  stored: string,
  masterSecret: string,
): string | null {
  if (!stored.startsWith(PREFIX)) return null;
  try {
    const raw = Buffer.from(stored.slice(PREFIX.length), 'base64');
    const iv = raw.subarray(0, IV_BYTES);
    const tag = raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
    const body = raw.subarray(IV_BYTES + TAG_BYTES);
    const decipher = createDecipheriv('aes-256-gcm', key(masterSecret), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString(
      'utf8',
    );
  } catch {
    return null;
  }
}
