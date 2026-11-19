import { describe, expect, it } from 'vitest';
import {
  CARD_FIELDS,
  visibleCardFields,
  buildLinkHref,
  normalizeLinkValue,
  setUsernameSchema,
  updateCardSchema,
} from './card';

describe('usernameSchema', () => {
  it.each(['ali', 'Ali_Nikpour', ' dr_ahmadi '])('accepts %s', (v) => {
    expect(setUsernameSchema.safeParse({ username: v }).success).toBe(true);
  });
  it('lowercases and trims', () => {
    const r = setUsernameSchema.parse({ username: '  Ali_N ' });
    expect(r.username).toBe('ali_n');
  });
  it.each(['ab', '1ali', 'ali-n', 'علی', 'a'.repeat(31), 'ali nik'])(
    'rejects %s',
    (v) => {
      expect(setUsernameSchema.safeParse({ username: v }).success).toBe(false);
    },
  );
  it.each(['login', 'requests', 'Admin', 'me', 'api'])(
    'rejects reserved %s',
    (v) => {
      expect(setUsernameSchema.safeParse({ username: v }).success).toBe(false);
    },
  );
});

describe('normalizeLinkValue', () => {
  it('extracts handles from full URLs and @-forms', () => {
    expect(normalizeLinkValue('ble', 'https://ble.ir/ali_n')).toBe('ali_n');
    expect(normalizeLinkValue('telegram', '@ali_nikpour')).toBe('ali_nikpour');
    expect(normalizeLinkValue('instagram', 'instagram.com/ali.n/?hl=fa')).toBe(
      'ali.n',
    );
    expect(
      normalizeLinkValue('linkedin', 'https://www.linkedin.com/in/ali-n/'),
    ).toBe('ali-n');
    expect(normalizeLinkValue('linkedin', 'ali.n')).toBe('ali.n');
  });
  it('canonicalizes WhatsApp numbers', () => {
    expect(normalizeLinkValue('whatsapp', '0912 345 6747')).toBe(
      '+989123456747',
    );
    expect(normalizeLinkValue('whatsapp', '12345')).toBeNull();
  });
  it('accepts only http(s) websites', () => {
    expect(normalizeLinkValue('website', 'alinikpour.ir')).toBe(
      'https://alinikpour.ir/',
    );
    expect(normalizeLinkValue('website', 'javascript:alert(1)')).toBeNull();
    expect(normalizeLinkValue('website', 'https://u:p@evil.com')).toBeNull();
    expect(normalizeLinkValue('website', 'localhost')).toBeNull();
  });
  it('rejects empty and handle-injection input', () => {
    expect(normalizeLinkValue('ble', '  ')).toBeNull();
    expect(normalizeLinkValue('ble', 'a b')).toBeNull();
    expect(normalizeLinkValue('ble', '"><script>')).toBeNull();
  });
});

describe('buildLinkHref', () => {
  it('builds per-kind URLs', () => {
    expect(buildLinkHref('ble', 'ali_n')).toBe('https://ble.ir/ali_n');
    expect(buildLinkHref('whatsapp', '+989123456747')).toBe(
      'https://wa.me/989123456747',
    );
    expect(buildLinkHref('website', 'https://alinikpour.ir/')).toBe(
      'https://alinikpour.ir/',
    );
  });
});

describe('card fields', () => {
  it('turns the stored hidden list into the visible fields', () => {
    expect(visibleCardFields([])).toEqual([...CARD_FIELDS]);
    expect(visibleCardFields(['avatar', 'phone', 'bogus'])).toEqual([
      'address',
      'website',
      'messengers',
    ]);
  });
  it('dedupes and validates cardFields on update', () => {
    expect(
      updateCardSchema.parse({ cardFields: ['phone', 'phone'] }).cardFields,
    ).toEqual(['phone']);
    expect(updateCardSchema.safeParse({ cardFields: ['email'] }).success).toBe(
      false,
    );
  });
});

describe('updateCardSchema', () => {
  it('normalizes links and rejects duplicate kinds', () => {
    const ok = updateCardSchema.parse({
      links: [{ kind: 'ble', value: 'https://ble.ir/ali_n' }],
    });
    expect(ok.links).toEqual([{ kind: 'ble', value: 'ali_n' }]);
    expect(
      updateCardSchema.safeParse({
        links: [
          { kind: 'ble', value: 'a1' },
          { kind: 'ble', value: 'a2' },
        ],
      }).success,
    ).toBe(false);
  });
  it('rejects an unknown template and kind', () => {
    expect(updateCardSchema.safeParse({ template: 'neon' }).success).toBe(
      false,
    );
    expect(
      updateCardSchema.safeParse({ links: [{ kind: 'myspace', value: 'x1' }] })
        .success,
    ).toBe(false);
  });
});
