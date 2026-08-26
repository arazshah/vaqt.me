import { describe, expect, it } from 'vitest';
import {
  listReviewsForUserSchema,
  reviewStatusSchema,
  submitReviewSchema,
} from './review';

describe('submitReviewSchema', () => {
  it('accepts a valid rating with no comment', () => {
    const result = submitReviewSchema.safeParse({
      conversationId: 'conv_1',
      rating: 5,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.comment).toBeUndefined();
    }
  });

  it('accepts a valid rating with a comment', () => {
    expect(
      submitReviewSchema.safeParse({
        conversationId: 'conv_1',
        rating: 4,
        comment: 'همکاری خوبی بود.',
      }).success,
    ).toBe(true);
  });

  it('trims the comment', () => {
    const result = submitReviewSchema.safeParse({
      conversationId: 'conv_1',
      rating: 3,
      comment: '  عالی بود  ',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.comment).toBe('عالی بود');
    }
  });

  it('rejects a missing conversationId', () => {
    expect(submitReviewSchema.safeParse({ rating: 5 }).success).toBe(false);
  });

  it('rejects rating below 1', () => {
    expect(
      submitReviewSchema.safeParse({ conversationId: 'conv_1', rating: 0 })
        .success,
    ).toBe(false);
  });

  it('rejects rating above 5', () => {
    expect(
      submitReviewSchema.safeParse({ conversationId: 'conv_1', rating: 6 })
        .success,
    ).toBe(false);
  });

  it('rejects a non-integer rating', () => {
    expect(
      submitReviewSchema.safeParse({ conversationId: 'conv_1', rating: 4.5 })
        .success,
    ).toBe(false);
  });

  it('rejects a comment longer than the maximum', () => {
    expect(
      submitReviewSchema.safeParse({
        conversationId: 'conv_1',
        rating: 5,
        comment: 'ا'.repeat(1001),
      }).success,
    ).toBe(false);
  });
});

describe('reviewStatusSchema', () => {
  it('accepts a non-empty conversationId', () => {
    expect(
      reviewStatusSchema.safeParse({ conversationId: 'conv_1' }).success,
    ).toBe(true);
  });

  it('rejects a missing conversationId', () => {
    expect(reviewStatusSchema.safeParse({}).success).toBe(false);
  });

  it('rejects an empty conversationId', () => {
    expect(reviewStatusSchema.safeParse({ conversationId: '' }).success).toBe(
      false,
    );
  });
});

describe('listReviewsForUserSchema', () => {
  it('accepts a userId with no cursor and defaults limit to 20', () => {
    const result = listReviewsForUserSchema.safeParse({ userId: 'usr_1' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(20);
      expect(result.data.cursor).toBeUndefined();
    }
  });

  it('accepts an explicit cursor and limit', () => {
    expect(
      listReviewsForUserSchema.safeParse({
        userId: 'usr_1',
        cursor: 'abc',
        limit: 10,
      }).success,
    ).toBe(true);
  });

  it('accepts a null cursor', () => {
    expect(
      listReviewsForUserSchema.safeParse({ userId: 'usr_1', cursor: null })
        .success,
    ).toBe(true);
  });

  it('rejects a missing userId', () => {
    expect(listReviewsForUserSchema.safeParse({}).success).toBe(false);
  });

  it('rejects a limit above the maximum', () => {
    expect(
      listReviewsForUserSchema.safeParse({ userId: 'usr_1', limit: 51 })
        .success,
    ).toBe(false);
  });

  it('rejects a limit below the minimum', () => {
    expect(
      listReviewsForUserSchema.safeParse({ userId: 'usr_1', limit: 0 }).success,
    ).toBe(false);
  });
});
