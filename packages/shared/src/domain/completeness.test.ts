import { describe, expect, it } from 'vitest';
import { computeProfileCompleteness } from './completeness';

const FULL = {
  phoneVerified: true,
  displayName: 'کاربر تست',
  bio: 'یک بیوگرافی کوتاه',
  skillCount: 1,
};

describe('computeProfileCompleteness', () => {
  it('a fully complete profile can both publish a request and submit an offer', () => {
    const result = computeProfileCompleteness(FULL);
    expect(result.canPublishRequest).toBe(true);
    expect(result.canSubmitOffer).toBe(true);
    expect(result.missingForPublishRequest).toEqual([]);
    expect(result.missingForSubmitOffer).toEqual([]);
  });

  it('publishing a request requires phoneVerified', () => {
    const result = computeProfileCompleteness({
      ...FULL,
      phoneVerified: false,
    });
    expect(result.canPublishRequest).toBe(false);
    expect(result.missingForPublishRequest).toContain('PHONE_VERIFIED');
  });

  it('publishing a request requires displayName', () => {
    const result = computeProfileCompleteness({ ...FULL, displayName: null });
    expect(result.canPublishRequest).toBe(false);
    expect(result.missingForPublishRequest).toContain('DISPLAY_NAME');
  });

  it('publishing a request does not require bio or skills', () => {
    const result = computeProfileCompleteness({
      ...FULL,
      bio: null,
      skillCount: 0,
    });
    expect(result.canPublishRequest).toBe(true);
  });

  it('an empty-string displayName counts as missing, not just null', () => {
    const result = computeProfileCompleteness({ ...FULL, displayName: '   ' });
    expect(result.missingForPublishRequest).toContain('DISPLAY_NAME');
  });

  it('submitting an offer requires displayName', () => {
    const result = computeProfileCompleteness({ ...FULL, displayName: null });
    expect(result.canSubmitOffer).toBe(false);
    expect(result.missingForSubmitOffer).toContain('DISPLAY_NAME');
  });

  it('submitting an offer requires bio', () => {
    const result = computeProfileCompleteness({ ...FULL, bio: null });
    expect(result.canSubmitOffer).toBe(false);
    expect(result.missingForSubmitOffer).toContain('BIO');
  });

  it('an empty-string bio counts as missing, not just null', () => {
    const result = computeProfileCompleteness({ ...FULL, bio: '   ' });
    expect(result.missingForSubmitOffer).toContain('BIO');
  });

  it('submitting an offer requires at least one skill', () => {
    const result = computeProfileCompleteness({ ...FULL, skillCount: 0 });
    expect(result.canSubmitOffer).toBe(false);
    expect(result.missingForSubmitOffer).toContain('AT_LEAST_ONE_SKILL');
  });

  it('submitting an offer does not require phoneVerified', () => {
    const result = computeProfileCompleteness({
      ...FULL,
      phoneVerified: false,
    });
    expect(result.canSubmitOffer).toBe(true);
  });

  it('reports every missing field at once, not just the first', () => {
    const result = computeProfileCompleteness({
      phoneVerified: false,
      displayName: null,
      bio: null,
      skillCount: 0,
    });
    expect(result.missingForPublishRequest).toEqual(
      expect.arrayContaining(['PHONE_VERIFIED', 'DISPLAY_NAME']),
    );
    expect(result.missingForSubmitOffer).toEqual(
      expect.arrayContaining(['DISPLAY_NAME', 'BIO', 'AT_LEAST_ONE_SKILL']),
    );
  });
});
