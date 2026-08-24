import type { AiChatMessage } from '@vaqt/shared';

export const AI_PORT = Symbol('AI_PORT');

export interface AiCategoryOption {
  id: string;
  name: string;
}

export interface AiExtractionResult {
  // Unknown on purpose — the adapter's job is to produce something that
  // *should* match AiExtractedDraft; AiService is the one place that
  // validates it with zod (see PROJECT_SPEC.md decision on AI provider:
  // "خروجی حتماً با zod اعتبارسنجی شود").
  raw: unknown;
  tokensUsed: number;
}

export interface AiPort {
  extract(
    messages: AiChatMessage[],
    categories: AiCategoryOption[],
  ): Promise<AiExtractionResult>;
}
