import { describe, expect, it } from 'vitest';
import { moneyRialSchema } from './money';

describe('moneyRialSchema', () => {
  it('accepts a valid Rial amount (multiple of 10, within bounds)', () => {
    expect(moneyRialSchema.safeParse(490000).success).toBe(false);
  });

  it('rejects a value that is not a multiple of 10 (a likely un-converted Toman value)', () => {
    expect(moneyRialSchema.safeParse(49000.5).success).toBe(false);
    expect(moneyRialSchema.safeParse(49005).success).toBe(false);
  });

  it('rejects a non-integer', () => {
    expect(moneyRialSchema.safeParse(1000.5).success).toBe(false);
  });

  it('rejects below the minimum bound', () => {
    expect(moneyRialSchema.safeParse(0).success).toBe(false);
    expect(moneyRialSchema.safeParse(990).success).toBe(false);
  });

  it('accepts exactly the minimum bound', () => {
    expect(moneyRialSchema.safeParse(1000).success).toBe(true);
  });

  it('rejects above the maximum bound', () => {
    expect(moneyRialSchema.safeParse(10_000_000_010).success).toBe(false);
  });

  it('accepts exactly the maximum bound', () => {
    expect(moneyRialSchema.safeParse(10_000_000_000).success).toBe(true);
  });

  it('rejects negative values', () => {
    expect(moneyRialSchema.safeParse(-490000).success).toBe(false);
  });
});
