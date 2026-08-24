import { describe, expect, it } from 'vitest';
import {
  getConversationSchema,
  listMessagesSchema,
  sendMessageSchema,
} from './message';

describe('getConversationSchema', () => {
  it('accepts a non-empty id', () => {
    expect(getConversationSchema.safeParse({ id: 'conv_1' }).success).toBe(
      true,
    );
  });

  it('rejects a missing id', () => {
    expect(getConversationSchema.safeParse({}).success).toBe(false);
  });

  it('rejects an empty id', () => {
    expect(getConversationSchema.safeParse({ id: '' }).success).toBe(false);
  });
});

describe('listMessagesSchema', () => {
  it('accepts a conversationId with no cursor and defaults limit to 30', () => {
    const result = listMessagesSchema.safeParse({
      conversationId: 'conv_1',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(30);
      expect(result.data.cursor).toBeUndefined();
    }
  });

  it('accepts an explicit cursor and limit', () => {
    const result = listMessagesSchema.safeParse({
      conversationId: 'conv_1',
      cursor: 'abc',
      limit: 10,
    });
    expect(result.success).toBe(true);
  });

  it('accepts a null cursor', () => {
    expect(
      listMessagesSchema.safeParse({ conversationId: 'conv_1', cursor: null })
        .success,
    ).toBe(true);
  });

  it('rejects a missing conversationId', () => {
    expect(listMessagesSchema.safeParse({}).success).toBe(false);
  });

  it('rejects a limit above the maximum', () => {
    expect(
      listMessagesSchema.safeParse({ conversationId: 'conv_1', limit: 51 })
        .success,
    ).toBe(false);
  });

  it('rejects a limit below the minimum', () => {
    expect(
      listMessagesSchema.safeParse({ conversationId: 'conv_1', limit: 0 })
        .success,
    ).toBe(false);
  });
});

describe('sendMessageSchema', () => {
  it('accepts a non-empty body', () => {
    expect(
      sendMessageSchema.safeParse({
        conversationId: 'conv_1',
        body: 'سلام، وقت بخیر.',
      }).success,
    ).toBe(true);
  });

  it('trims the body', () => {
    const result = sendMessageSchema.safeParse({
      conversationId: 'conv_1',
      body: '  سلام  ',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.body).toBe('سلام');
    }
  });

  it('rejects an empty body', () => {
    expect(
      sendMessageSchema.safeParse({ conversationId: 'conv_1', body: '' })
        .success,
    ).toBe(false);
  });

  it('rejects a body that is only whitespace', () => {
    expect(
      sendMessageSchema.safeParse({ conversationId: 'conv_1', body: '   ' })
        .success,
    ).toBe(false);
  });

  it('rejects a body longer than the maximum', () => {
    expect(
      sendMessageSchema.safeParse({
        conversationId: 'conv_1',
        body: 'ا'.repeat(4001),
      }).success,
    ).toBe(false);
  });

  it('rejects a missing conversationId', () => {
    expect(sendMessageSchema.safeParse({ body: 'سلام' }).success).toBe(false);
  });
});
