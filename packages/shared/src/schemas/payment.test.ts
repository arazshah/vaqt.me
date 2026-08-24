import { describe, expect, it } from 'vitest';
import { checkoutSchema, getOrderSchema } from './payment';

describe('checkoutSchema', () => {
  it('accepts a valid productCode without a requestId', () => {
    expect(
      checkoutSchema.safeParse({ productCode: 'PRO_MONTHLY' }).success,
    ).toBe(true);
  });

  it('accepts a valid productCode with a requestId', () => {
    expect(
      checkoutSchema.safeParse({
        productCode: 'URGENT_BADGE',
        requestId: 'req_1',
      }).success,
    ).toBe(true);
  });

  it('accepts a null requestId', () => {
    expect(
      checkoutSchema.safeParse({ productCode: 'BUMP', requestId: null })
        .success,
    ).toBe(true);
  });

  it('rejects an unknown productCode', () => {
    expect(
      checkoutSchema.safeParse({ productCode: 'NOT_A_PRODUCT' }).success,
    ).toBe(false);
  });

  it('rejects a missing productCode', () => {
    expect(checkoutSchema.safeParse({}).success).toBe(false);
  });
});

describe('getOrderSchema', () => {
  it('accepts a non-empty id', () => {
    expect(getOrderSchema.safeParse({ id: 'order_1' }).success).toBe(true);
  });

  it('rejects a missing id', () => {
    expect(getOrderSchema.safeParse({}).success).toBe(false);
  });

  it('rejects an empty id', () => {
    expect(getOrderSchema.safeParse({ id: '' }).success).toBe(false);
  });
});
