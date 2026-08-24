import { z } from 'zod';
import { RequestModeSchema } from '../constants/enums';

// A conversation turn as persisted in AiSession.messages (Json). Mirrors
// the Anthropic Messages API role set — no "system" here, the system
// prompt is injected separately per call, never stored as a turn.
export const aiChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1),
});
export type AiChatMessage = z.infer<typeof aiChatMessageSchema>;

// What the model extracts from the conversation so far. Every field is
// nullable/optional by design — this is a draft in progress, not a
// publish-ready payload (that validation is createRequestSchema, applied
// later when the user reviews/edits the prefilled form). categoryId is
// validated against real categories by AiService, not by this schema,
// since the model has no direct DB access.
export const aiExtractedDraftSchema = z.object({
  title: z.string().trim().min(5).max(120).nullable(),
  description: z.string().trim().min(20).max(3000).nullable(),
  categoryId: z.string().min(1).nullable(),
  mode: RequestModeSchema.nullable(),
  city: z.string().trim().max(80).nullable(),
  durationMinutes: z.number().int().min(15).max(1440).nullable(),
  budgetMinRial: z.number().int().min(0).nullable(),
  budgetMaxRial: z.number().int().min(0).nullable(),
  // Field names from the list above that are still missing/invalid —
  // drives both the "ready to review" gate and the follow-up question.
  missingFields: z.array(z.string()),
  // A single Persian question to ask the user next, or null once
  // missingFields is empty and the draft is ready for review.
  clarifyingQuestion: z.string().trim().min(1).nullable(),
});
export type AiExtractedDraft = z.infer<typeof aiExtractedDraftSchema>;

export const startAiSessionSchema = z.object({
  message: z.string().trim().min(1, 'پیام نمی‌تواند خالی باشد').max(4000),
});
export type StartAiSessionInput = z.infer<typeof startAiSessionSchema>;

export const continueAiSessionSchema = z.object({
  sessionId: z.string().min(1, 'شناسه‌ی نشست الزامی است'),
  message: z.string().trim().min(1, 'پیام نمی‌تواند خالی باشد').max(4000),
});
export type ContinueAiSessionInput = z.infer<typeof continueAiSessionSchema>;
