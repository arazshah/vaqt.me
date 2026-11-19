import { describe, expect, it } from 'vitest';
import {
  cardStatsQuerySchema,
  normalizeSource,
  qrSource,
  recordCardEventSchema,
} from './analytics';

describe('normalizeSource', () => {
  it('keeps known sources and maps the rest', () => {
    expect(normalizeSource(qrSource('office'))).toBe('qr-office');
    expect(normalizeSource('QR-Insta')).toBe('qr-insta');
    expect(normalizeSource(undefined)).toBe('direct');
    expect(normalizeSource('  ')).toBe('direct');
    expect(normalizeSource('spam-campaign')).toBe('other');
  });
});

describe('recordCardEventSchema', () => {
  it('accepts a click on a known link kind', () => {
    expect(
      recordCardEventSchema.safeParse({ type: 'link_click', linkKind: 'ble' })
        .success,
    ).toBe(true);
  });
  it('rejects unknown event types and link kinds', () => {
    expect(recordCardEventSchema.safeParse({ type: 'purchase' }).success).toBe(
      false,
    );
    expect(
      recordCardEventSchema.safeParse({
        type: 'link_click',
        linkKind: 'myspace',
      }).success,
    ).toBe(false);
  });
});

describe('cardStatsQuerySchema', () => {
  it('defaults to 7 days and only allows 7 or 30', () => {
    expect(cardStatsQuerySchema.parse({}).days).toBe(7);
    expect(cardStatsQuerySchema.parse({ days: 30 }).days).toBe(30);
    expect(cardStatsQuerySchema.safeParse({ days: 90 }).success).toBe(false);
  });
});
