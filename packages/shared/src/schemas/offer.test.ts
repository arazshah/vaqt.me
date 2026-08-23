import { describe, expect, it } from 'vitest';
import {
  listOffersForRequestSchema,
  selectOfferSchema,
  submitOfferSchema,
  withdrawOfferSchema,
} from './offer';

function validSubmitInput(overrides: Record<string, unknown> = {}) {
  return {
    requestId: 'req_1',
    proposedStartAt: new Date(Date.now() + 86_400_000).toISOString(),
    proposedDurationMinutes: 60,
    amountRial: 1_000_000,
    ...overrides,
  };
}

describe('submitOfferSchema', () => {
  it('accepts a valid input without a message', () => {
    const result = submitOfferSchema.safeParse(validSubmitInput());
    expect(result.success).toBe(true);
  });

  it('accepts a valid input with a message', () => {
    const result = submitOfferSchema.safeParse(
      validSubmitInput({ message: 'می‌توانم فردا شروع کنم.' }),
    );
    expect(result.success).toBe(true);
  });

  it('rejects a proposedStartAt in the past', () => {
    const result = submitOfferSchema.safeParse(
      validSubmitInput({
        proposedStartAt: new Date(Date.now() - 1000).toISOString(),
      }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects a duration below the minimum', () => {
    const result = submitOfferSchema.safeParse(
      validSubmitInput({ proposedDurationMinutes: 5 }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects a duration above the maximum', () => {
    const result = submitOfferSchema.safeParse(
      validSubmitInput({ proposedDurationMinutes: 1441 }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects an amountRial that is not a multiple of 10', () => {
    const result = submitOfferSchema.safeParse(
      validSubmitInput({ amountRial: 1_000_005 }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects a missing requestId', () => {
    const result = submitOfferSchema.safeParse(
      validSubmitInput({ requestId: undefined }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects a message longer than the maximum', () => {
    const result = submitOfferSchema.safeParse(
      validSubmitInput({ message: 'ا'.repeat(2001) }),
    );
    expect(result.success).toBe(false);
  });
});

describe('selectOfferSchema', () => {
  it('accepts a non-empty offerId', () => {
    expect(selectOfferSchema.safeParse({ offerId: 'off_1' }).success).toBe(
      true,
    );
  });

  it('rejects a missing offerId', () => {
    expect(selectOfferSchema.safeParse({}).success).toBe(false);
  });
});

describe('withdrawOfferSchema', () => {
  it('accepts a non-empty offerId', () => {
    expect(withdrawOfferSchema.safeParse({ offerId: 'off_1' }).success).toBe(
      true,
    );
  });

  it('rejects an empty offerId', () => {
    expect(withdrawOfferSchema.safeParse({ offerId: '' }).success).toBe(false);
  });
});

describe('listOffersForRequestSchema', () => {
  it('accepts a non-empty requestId', () => {
    expect(
      listOffersForRequestSchema.safeParse({ requestId: 'req_1' }).success,
    ).toBe(true);
  });

  it('rejects a missing requestId', () => {
    expect(listOffersForRequestSchema.safeParse({}).success).toBe(false);
  });
});
