import { describe, expect, it } from 'vitest';
import {
  createRequestSchema,
  listRequestsSchema,
  publishRequestSchema,
} from './request';

function validCreateInput(overrides: Record<string, unknown> = {}) {
  return {
    title: 'کمک برای مصاحبه فنی',
    description: 'به یک مصاحبه‌ی شبیه‌سازی‌شده برای موقعیت بک‌اند نیاز دارم.',
    categoryId: 'cat_1',
    mode: 'ONLINE',
    durationMinutes: 60,
    budgetMinRial: 1_000_000,
    budgetMaxRial: 2_000_000,
    deadlineAt: new Date(Date.now() + 86_400_000).toISOString(),
    ...overrides,
  };
}

describe('createRequestSchema', () => {
  it('accepts a valid input and defaults preferredWindows to an empty array', () => {
    const result = createRequestSchema.safeParse(validCreateInput());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.preferredWindows).toEqual([]);
    }
  });

  it('accepts explicit preferredWindows entries', () => {
    const result = createRequestSchema.safeParse(
      validCreateInput({
        preferredWindows: [{ day: 'شنبه', start: '18:00', end: '20:00' }],
      }),
    );
    expect(result.success).toBe(true);
  });

  it('rejects a preferredWindows entry with a malformed time', () => {
    const result = createRequestSchema.safeParse(
      validCreateInput({
        preferredWindows: [{ day: 'شنبه', start: '25:00', end: '20:00' }],
      }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects when budgetMaxRial is below budgetMinRial', () => {
    const result = createRequestSchema.safeParse(
      validCreateInput({ budgetMinRial: 2_000_000, budgetMaxRial: 1_000_000 }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects a deadline in the past', () => {
    const result = createRequestSchema.safeParse(
      validCreateInput({
        deadlineAt: new Date(Date.now() - 1000).toISOString(),
      }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects a title shorter than the minimum', () => {
    const result = createRequestSchema.safeParse(
      validCreateInput({ title: 'کم' }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects an invalid mode', () => {
    const result = createRequestSchema.safeParse(
      validCreateInput({ mode: 'TELEPORT' }),
    );
    expect(result.success).toBe(false);
  });
});

describe('publishRequestSchema', () => {
  it('accepts a non-empty id', () => {
    expect(publishRequestSchema.safeParse({ id: 'req_1' }).success).toBe(true);
  });

  it('rejects an empty id', () => {
    expect(publishRequestSchema.safeParse({ id: '' }).success).toBe(false);
  });

  it('rejects a missing id', () => {
    expect(publishRequestSchema.safeParse({}).success).toBe(false);
  });
});

describe('listRequestsSchema', () => {
  it('defaults limit to 20 and cursor to undefined when omitted', () => {
    const result = listRequestsSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(20);
      expect(result.data.cursor).toBeUndefined();
    }
  });

  it('rejects a limit above the maximum', () => {
    expect(listRequestsSchema.safeParse({ limit: 51 }).success).toBe(false);
  });

  it('rejects a limit of zero', () => {
    expect(listRequestsSchema.safeParse({ limit: 0 }).success).toBe(false);
  });

  it('accepts a provided cursor string', () => {
    const result = listRequestsSchema.safeParse({ cursor: 'abc' });
    expect(result.success).toBe(true);
  });

  it('leaves id undefined when omitted', () => {
    const result = listRequestsSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBeUndefined();
    }
  });

  it('accepts a provided id string', () => {
    const result = listRequestsSchema.safeParse({ id: 'req-123' });
    expect(result.success).toBe(true);
  });

  it('rejects an empty id string', () => {
    expect(listRequestsSchema.safeParse({ id: '' }).success).toBe(false);
  });
});
