import { describe, expect, it } from 'vitest';
import { decodeCursor, encodeCursor } from './pagination';

describe('cursor encode/decode', () => {
  it('round-trips a plain object', () => {
    const value = { listTier: 2, id: 'abc123' };
    expect(decodeCursor(encodeCursor(value))).toEqual(value);
  });

  it('round-trips Persian text without corruption', () => {
    const value = { title: 'بازبینی پایان‌نامه' };
    expect(decodeCursor(encodeCursor(value))).toEqual(value);
  });

  it('produces a URL-safe string (no +, /, or = characters)', () => {
    const cursor = encodeCursor({ a: 'value with special chars !@#$%^&*()' });
    expect(cursor).not.toMatch(/[+/=]/);
  });

  it('decodeCursor returns null for garbage input instead of throwing', () => {
    expect(decodeCursor('not-valid-base64-json!!!')).toBeNull();
  });

  it('decodeCursor returns null for valid base64 that is not JSON', () => {
    const notJson = btoa('this is not json').replace(/=+$/, '');
    expect(decodeCursor(notJson)).toBeNull();
  });
});
