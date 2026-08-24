import { describe, expect, it } from 'vitest';
import {
  aiChatMessageSchema,
  aiExtractedDraftSchema,
  continueAiSessionSchema,
  startAiSessionSchema,
} from './ai';

describe('aiChatMessageSchema', () => {
  it('accepts a user turn', () => {
    expect(
      aiChatMessageSchema.safeParse({ role: 'user', content: 'سلام' }).success,
    ).toBe(true);
  });

  it('accepts an assistant turn', () => {
    expect(
      aiChatMessageSchema.safeParse({ role: 'assistant', content: 'بله؟' })
        .success,
    ).toBe(true);
  });

  it('rejects a system role', () => {
    expect(
      aiChatMessageSchema.safeParse({ role: 'system', content: 'x' }).success,
    ).toBe(false);
  });

  it('rejects empty content', () => {
    expect(
      aiChatMessageSchema.safeParse({ role: 'user', content: '' }).success,
    ).toBe(false);
  });
});

const fullDraft = {
  title: 'ترجمه یک مقاله تخصصی',
  description: 'نیاز به ترجمه‌ی یک مقاله ده صفحه‌ای از انگلیسی به فارسی دارم.',
  categoryId: 'cat_1',
  mode: 'ONLINE',
  city: null,
  durationMinutes: 120,
  budgetMinRial: 1_000_000,
  budgetMaxRial: 2_000_000,
  missingFields: [],
  clarifyingQuestion: null,
};

describe('aiExtractedDraftSchema', () => {
  it('accepts a fully-populated ready draft', () => {
    expect(aiExtractedDraftSchema.safeParse(fullDraft).success).toBe(true);
  });

  it('accepts a partial draft with nulls and a clarifying question', () => {
    const result = aiExtractedDraftSchema.safeParse({
      ...fullDraft,
      categoryId: null,
      budgetMinRial: null,
      budgetMaxRial: null,
      missingFields: ['categoryId', 'budgetMinRial', 'budgetMaxRial'],
      clarifyingQuestion: 'این کار در چه دسته‌بندی‌ای قرار می‌گیرد؟',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid mode value', () => {
    expect(
      aiExtractedDraftSchema.safeParse({ ...fullDraft, mode: 'REMOTE' })
        .success,
    ).toBe(false);
  });

  it('rejects a missing missingFields array', () => {
    const { missingFields: _missingFields, ...rest } = fullDraft;
    expect(aiExtractedDraftSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects a title shorter than the minimum', () => {
    expect(
      aiExtractedDraftSchema.safeParse({ ...fullDraft, title: 'کم' }).success,
    ).toBe(false);
  });
});

describe('startAiSessionSchema', () => {
  it('accepts a non-empty message', () => {
    expect(
      startAiSessionSchema.safeParse({ message: 'یک برنامه‌نویس می‌خواهم' })
        .success,
    ).toBe(true);
  });

  it('rejects an empty message', () => {
    expect(startAiSessionSchema.safeParse({ message: '' }).success).toBe(false);
  });

  it('rejects a message over the max length', () => {
    expect(
      startAiSessionSchema.safeParse({ message: 'a'.repeat(4001) }).success,
    ).toBe(false);
  });
});

describe('continueAiSessionSchema', () => {
  it('accepts a sessionId and message', () => {
    expect(
      continueAiSessionSchema.safeParse({
        sessionId: 'sess_1',
        message: 'بله همینه',
      }).success,
    ).toBe(true);
  });

  it('rejects a missing sessionId', () => {
    expect(
      continueAiSessionSchema.safeParse({ message: 'بله همینه' }).success,
    ).toBe(false);
  });

  it('rejects an empty message', () => {
    expect(
      continueAiSessionSchema.safeParse({ sessionId: 'sess_1', message: '' })
        .success,
    ).toBe(false);
  });
});
