import { prisma } from '@vaqt/db';
import type { AiChatMessage } from '@vaqt/shared';
import { fakeConfig } from '../test-support/fake-config';
import { AiConfigService } from './ai.config';
import {
  AI_DRAFT_READY_MESSAGE_FA,
  AI_FALLBACK_MESSAGE_FA,
} from './ai.messages.fa';
import { AiService } from './ai.service';
import type { AiExtractionResult, AiPort } from './ai.port';
import { MockAiAdapter } from './mock-ai.adapter';

const VALID_DRAFT = {
  title: 'ترجمه یک مقاله',
  description: 'یک مقاله ده صفحه‌ای نیاز به ترجمه دارد.',
  categoryId: null as string | null,
  mode: 'ONLINE',
  city: null,
  durationMinutes: 60,
  budgetMinRial: 1_000_000,
  budgetMaxRial: 2_000_000,
  missingFields: [] as string[],
  clarifyingQuestion: null,
};

class QueueAiPort implements AiPort {
  private index = 0;

  constructor(private readonly responses: unknown[]) {}

  extract(): Promise<AiExtractionResult> {
    const raw = this.responses[Math.min(this.index, this.responses.length - 1)];
    this.index += 1;
    return Promise.resolve({ raw, tokensUsed: 10 });
  }

  get callCount(): number {
    return this.index;
  }
}

describe('AiService (real Postgres)', () => {
  const createdSessionIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdCategoryIds: string[] = [];
  let categoryId: string;

  beforeAll(async () => {
    const category = await prisma.category.create({
      data: { name: 'ترجمه', slug: `translation-${String(Date.now())}` },
    });
    categoryId = category.id;
    createdCategoryIds.push(category.id);
  });

  afterAll(async () => {
    for (const id of createdSessionIds.splice(0)) {
      await prisma.aiSession.deleteMany({ where: { id } });
    }
    for (const id of createdUserIds.splice(0)) {
      await prisma.user.deleteMany({ where: { id } });
    }
    for (const id of createdCategoryIds.splice(0)) {
      await prisma.category.deleteMany({ where: { id } });
    }
    await prisma.$disconnect();
  });

  function uniquePhone(): string {
    return `+9898${String(Date.now()).slice(-4)}${String(
      Math.floor(Math.random() * 10000),
    ).padStart(4, '0')}`;
  }

  async function makeUser(): Promise<string> {
    const user = await prisma.user.create({
      data: { phone: uniquePhone(), displayName: 'کاربر تست AI' },
    });
    createdUserIds.push(user.id);
    return user.id;
  }

  function makeService(port: AiPort): AiService {
    return new AiService(port, new AiConfigService(fakeConfig({})));
  }

  describe('start', () => {
    it('persists a session and returns the extracted draft on first success', async () => {
      const userId = await makeUser();
      const port = new QueueAiPort([{ ...VALID_DRAFT, categoryId }]);
      const service = makeService(port);

      const result = await service.start(userId, 'یک ترجمه نیاز دارم');
      createdSessionIds.push(result.id);

      expect(result.needsManualForm).toBe(false);
      expect(result.fallbackMessage).toBeNull();
      expect(result.draft?.categoryId).toBe(categoryId);
      expect(result.messages).toEqual<AiChatMessage[]>([
        { role: 'user', content: 'یک ترجمه نیاز دارم' },
        { role: 'assistant', content: AI_DRAFT_READY_MESSAGE_FA },
      ]);
      expect(port.callCount).toBe(1);

      const stored = await prisma.aiSession.findUniqueOrThrow({
        where: { id: result.id },
      });
      expect(stored.userId).toBe(userId);
      expect(stored.provider).toBe('mock');
      expect(stored.tokensUsed).toBe(10);
    });

    it('retries once on an invalid draft, then succeeds', async () => {
      const userId = await makeUser();
      const port = new QueueAiPort([
        // durationMinutes below the schema's min(15) — a shape violation
        // aiExtractedDraftSchema rejects outright, forcing a retry.
        { ...VALID_DRAFT, durationMinutes: 5 },
        { ...VALID_DRAFT, categoryId },
      ]);
      const service = makeService(port);

      const result = await service.start(userId, 'یک کاری دارم');
      createdSessionIds.push(result.id);

      expect(port.callCount).toBe(2);
      expect(result.needsManualForm).toBe(false);
      expect(result.draft?.categoryId).toBe(categoryId);

      const stored = await prisma.aiSession.findUniqueOrThrow({
        where: { id: result.id },
      });
      // Two calls, 10 tokens each.
      expect(stored.tokensUsed).toBe(20);
    });

    it('retries once on an unknown categoryId, then succeeds', async () => {
      const userId = await makeUser();
      const port = new QueueAiPort([
        { ...VALID_DRAFT, categoryId: 'not-a-real-category' },
        { ...VALID_DRAFT, categoryId },
      ]);
      const service = makeService(port);

      const result = await service.start(userId, 'یک کاری دارم');
      createdSessionIds.push(result.id);

      expect(port.callCount).toBe(2);
      expect(result.draft?.categoryId).toBe(categoryId);
    });

    it('falls back to the manual form after exhausting retries', async () => {
      const userId = await makeUser();
      const port = new QueueAiPort([
        { ...VALID_DRAFT, durationMinutes: 5 },
        { ...VALID_DRAFT, durationMinutes: 5 },
      ]);
      const service = makeService(port);

      const result = await service.start(userId, 'یک کاری دارم');
      createdSessionIds.push(result.id);

      expect(port.callCount).toBe(2);
      expect(result.needsManualForm).toBe(true);
      expect(result.draft).toBeNull();
      expect(result.fallbackMessage).toBe(AI_FALLBACK_MESSAGE_FA);
    });

    it('accepts a null categoryId (still missing, not yet invalid)', async () => {
      const userId = await makeUser();
      const port = new QueueAiPort([
        {
          ...VALID_DRAFT,
          categoryId: null,
          missingFields: ['categoryId'],
          clarifyingQuestion: 'این کار در چه دسته‌بندی‌ای قرار می‌گیرد؟',
        },
      ]);
      const service = makeService(port);

      const result = await service.start(userId, 'یک کاری دارم');
      createdSessionIds.push(result.id);

      expect(port.callCount).toBe(1);
      expect(result.needsManualForm).toBe(false);
      expect(result.draft?.categoryId).toBeNull();
      expect(result.draft?.missingFields).toEqual(['categoryId']);
    });
  });

  describe('continueSession', () => {
    it('appends the new message to the prior conversation', async () => {
      const userId = await makeUser();
      const clarifyingQuestion = 'بودجه‌ی تقریبی شما برای این کار چقدر است؟';
      const port = new QueueAiPort([
        {
          ...VALID_DRAFT,
          categoryId,
          budgetMinRial: null,
          budgetMaxRial: null,
          missingFields: ['budgetMinRial', 'budgetMaxRial'],
          clarifyingQuestion,
        },
        { ...VALID_DRAFT, categoryId },
      ]);
      const service = makeService(port);

      const first = await service.start(userId, 'ترجمه یک مقاله می‌خواهم');
      createdSessionIds.push(first.id);
      expect(first.messages).toEqual<AiChatMessage[]>([
        { role: 'user', content: 'ترجمه یک مقاله می‌خواهم' },
        { role: 'assistant', content: clarifyingQuestion },
      ]);

      const second = await service.continueSession(
        userId,
        first.id,
        'بودجه‌ام حدود دو میلیون تومان است',
      );

      expect(second.messages).toEqual<AiChatMessage[]>([
        { role: 'user', content: 'ترجمه یک مقاله می‌خواهم' },
        { role: 'assistant', content: clarifyingQuestion },
        { role: 'user', content: 'بودجه‌ام حدود دو میلیون تومان است' },
        { role: 'assistant', content: AI_DRAFT_READY_MESSAGE_FA },
      ]);
      expect(second.draft?.budgetMinRial).toBe(VALID_DRAFT.budgetMinRial);

      const stored = await prisma.aiSession.findUniqueOrThrow({
        where: { id: first.id },
      });
      expect(stored.tokensUsed).toBe(20);
    });

    it('rejects a session that belongs to a different user (404, no leak)', async () => {
      const ownerId = await makeUser();
      const otherUserId = await makeUser();
      const port = new QueueAiPort([{ ...VALID_DRAFT, categoryId }]);
      const service = makeService(port);

      const session = await service.start(ownerId, 'یک کاری دارم');
      createdSessionIds.push(session.id);

      await expect(
        service.continueSession(otherUserId, session.id, 'پیام دیگر'),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('rejects an unknown sessionId (404)', async () => {
      const userId = await makeUser();
      const port = new QueueAiPort([{ ...VALID_DRAFT, categoryId }]);
      const service = makeService(port);

      await expect(
        service.continueSession(userId, 'does-not-exist', 'سلام'),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  describe('MockAiAdapter integration', () => {
    it('extracts fields deterministically from a single detailed message', async () => {
      const userId = await makeUser();
      const service = makeService(new MockAiAdapter());

      const message =
        'یک ترجمه آنلاین در تهران نیاز دارم، حدود ۶۰ دقیقه طول می‌کشد و بودجه‌ام بین ۱ تا ۲ میلیون تومان است.';
      const result = await service.start(userId, message);
      createdSessionIds.push(result.id);

      expect(result.needsManualForm).toBe(false);
      expect(result.draft?.categoryId).toBe(categoryId);
      expect(result.draft?.mode).toBe('ONLINE');
      expect(result.draft?.city).toBe('تهران');
      expect(result.draft?.durationMinutes).toBe(60);
      expect(result.draft?.budgetMinRial).toBe(10_000_000);
      expect(result.draft?.budgetMaxRial).toBe(20_000_000);
      expect(result.draft?.missingFields).toEqual([]);
    });

    it('reports missing fields and a clarifying question for a vague message', async () => {
      const userId = await makeUser();
      const service = makeService(new MockAiAdapter());

      const result = await service.start(userId, 'یک کمکی می‌خواهم');
      createdSessionIds.push(result.id);

      expect(result.needsManualForm).toBe(false);
      expect(result.draft?.missingFields.length).toBeGreaterThan(0);
      expect(result.draft?.clarifyingQuestion).not.toBeNull();
    });
  });
});
