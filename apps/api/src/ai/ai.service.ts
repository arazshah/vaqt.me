import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma, prisma } from '@vaqt/db';
import {
  aiExtractedDraftSchema,
  type AiChatMessage,
  type AiExtractedDraft,
} from '@vaqt/shared';
import { AppError } from '../common/errors/app-error';
import { ErrorCode } from '../common/errors/error-codes';
import { AI_PORT, type AiCategoryOption, type AiPort } from './ai.port';
import { AiConfigService } from './ai.config';
import {
  AI_DRAFT_READY_MESSAGE_FA,
  AI_FALLBACK_MESSAGE_FA,
} from './ai.messages.fa';

export interface AiSessionResponse {
  id: string;
  messages: AiChatMessage[];
  draft: AiExtractedDraft | null;
  needsManualForm: boolean;
  fallbackMessage: string | null;
}

const CORRECTIVE_INSTRUCTION =
  'خروجی قبلی با قالب درخواست‌شده مطابقت نداشت یا category_id نامعتبر بود. لطفاً دوباره و دقیقاً طبق ابزار extract_request_draft با یک category_id معتبر از فهرست پاسخ بده.';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    @Inject(AI_PORT) private readonly aiPort: AiPort,
    private readonly aiConfig: AiConfigService,
  ) {}

  async start(userId: string, message: string): Promise<AiSessionResponse> {
    const userTurn: AiChatMessage = { role: 'user', content: message };
    const { draft, needsManualForm, tokensUsed } = await this.extractWithRetry([
      userTurn,
    ]);
    const messages = this.appendAssistantTurn(
      [userTurn],
      draft,
      needsManualForm,
    );

    const session = await prisma.aiSession.create({
      data: {
        userId,
        messages,
        extractedDraft: draft as unknown as Prisma.InputJsonValue,
        tokensUsed,
        provider: this.aiConfig.provider,
      },
    });

    return this.toResponse(session.id, messages, draft, needsManualForm);
  }

  async continueSession(
    userId: string,
    sessionId: string,
    message: string,
  ): Promise<AiSessionResponse> {
    const session = await prisma.aiSession.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.userId !== userId) {
      throw new AppError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    }

    const priorMessages = session.messages as unknown as AiChatMessage[];
    const withUserTurn: AiChatMessage[] = [
      ...priorMessages,
      { role: 'user', content: message },
    ];
    const { draft, needsManualForm, tokensUsed } =
      await this.extractWithRetry(withUserTurn);
    const messages = this.appendAssistantTurn(
      withUserTurn,
      draft,
      needsManualForm,
    );

    const updated = await prisma.aiSession.update({
      where: { id: sessionId },
      data: {
        messages,
        extractedDraft: draft as unknown as Prisma.InputJsonValue,
        tokensUsed: { increment: tokensUsed },
      },
    });

    return this.toResponse(updated.id, messages, draft, needsManualForm);
  }

  // Every extraction round becomes a full user/assistant turn pair in the
  // stored history — required for the real Anthropic adapter, whose
  // Messages API expects alternating roles, and useful for the mock/tests
  // too since it means the wizard's chat UI can render exactly what was
  // persisted, no reconstruction needed.
  private appendAssistantTurn(
    messages: AiChatMessage[],
    draft: AiExtractedDraft | null,
    needsManualForm: boolean,
  ): AiChatMessage[] {
    const content = needsManualForm
      ? AI_FALLBACK_MESSAGE_FA
      : (draft?.clarifyingQuestion ?? AI_DRAFT_READY_MESSAGE_FA);
    return [...messages, { role: 'assistant', content }];
  }

  private async extractWithRetry(messages: AiChatMessage[]): Promise<{
    draft: AiExtractedDraft | null;
    needsManualForm: boolean;
    tokensUsed: number;
  }> {
    const categories = await this.listCategories();
    let totalTokens = 0;
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.aiConfig.maxRetries; attempt++) {
      // Folded into the trailing user turn rather than pushed as a new
      // one — messages here always ends in a 'user' turn (no assistant
      // reply has been recorded for this round yet), and the real
      // Anthropic adapter's Messages API expects strictly alternating
      // roles, so two consecutive 'user' turns would be rejected.
      const attemptMessages: AiChatMessage[] =
        attempt === 0 ? messages : this.withCorrectiveSuffix(messages);

      try {
        const result = await this.aiPort.extract(attemptMessages, categories);
        totalTokens += result.tokensUsed;

        const parsed = aiExtractedDraftSchema.safeParse(result.raw);
        if (
          parsed.success &&
          this.isCategoryValid(parsed.data.categoryId, categories)
        ) {
          return {
            draft: parsed.data,
            needsManualForm: false,
            tokensUsed: totalTokens,
          };
        }
        lastError = parsed.success
          ? new Error(`invalid categoryId: ${String(parsed.data.categoryId)}`)
          : parsed.error;
      } catch (error) {
        lastError = error;
      }
    }

    this.logger.warn(
      'AI extraction failed after retry, falling back to manual form',
      lastError,
    );
    return { draft: null, needsManualForm: true, tokensUsed: totalTokens };
  }

  private withCorrectiveSuffix(messages: AiChatMessage[]): AiChatMessage[] {
    const last = messages[messages.length - 1];
    return [
      ...messages.slice(0, -1),
      { ...last, content: `${last.content}\n\n${CORRECTIVE_INSTRUCTION}` },
    ];
  }

  private isCategoryValid(
    categoryId: string | null,
    categories: AiCategoryOption[],
  ): boolean {
    return categoryId === null || categories.some((c) => c.id === categoryId);
  }

  private async listCategories(): Promise<AiCategoryOption[]> {
    return prisma.category.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    });
  }

  private toResponse(
    id: string,
    messages: AiChatMessage[],
    draft: AiExtractedDraft | null,
    needsManualForm: boolean,
  ): AiSessionResponse {
    return {
      id,
      messages,
      draft,
      needsManualForm,
      fallbackMessage: needsManualForm ? AI_FALLBACK_MESSAGE_FA : null,
    };
  }
}
