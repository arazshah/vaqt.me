import { Injectable, Logger } from '@nestjs/common';
import type { AiChatMessage } from '@vaqt/shared';
import { CLARIFY_SYSTEM_PROMPT_FA } from './prompts/clarify.fa';
import type { AiCategoryOption, AiExtractionResult, AiPort } from './ai.port';

const ANTHROPIC_MESSAGES_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_API_VERSION = '2023-06-01';
const EXTRACT_TOOL_NAME = 'extract_request_draft';
const MAX_TOKENS = 1024;

// snake_case on purpose — this is the tool's input schema as the model
// sees it, not a wire contract with our own frontend. The adapter maps
// every field back to the camelCase AiExtractedDraft shape before
// returning, so nothing outside this file ever sees snake_case.
function buildExtractTool(categories: AiCategoryOption[]) {
  const categoryIds = categories.map((c) => c.id);
  return {
    name: EXTRACT_TOOL_NAME,
    description:
      'استخراج فیلدهای درخواست از گفتگو تا این لحظه، حتی اگر ناقص باشند.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: ['string', 'null'] },
        description: { type: ['string', 'null'] },
        category_id: {
          type: ['string', 'null'],
          enum: [...categoryIds, null],
        },
        mode: {
          type: ['string', 'null'],
          enum: ['ONLINE', 'IN_PERSON', 'HYBRID', null],
        },
        city: { type: ['string', 'null'] },
        duration_minutes: { type: ['integer', 'null'] },
        budget_min_rial: { type: ['integer', 'null'] },
        budget_max_rial: { type: ['integer', 'null'] },
        missing_fields: { type: 'array', items: { type: 'string' } },
        clarifying_question: { type: ['string', 'null'] },
      },
      required: [
        'title',
        'description',
        'category_id',
        'mode',
        'city',
        'duration_minutes',
        'budget_min_rial',
        'budget_max_rial',
        'missing_fields',
        'clarifying_question',
      ],
    },
  };
}

interface AnthropicToolUseBlock {
  type: 'tool_use';
  name: string;
  input: Record<string, unknown>;
}

interface AnthropicResponse {
  content: (AnthropicToolUseBlock | { type: string })[];
  usage?: { input_tokens: number; output_tokens: number };
}

function categoryListForPrompt(categories: AiCategoryOption[]): string {
  return categories.map((c) => `- ${c.id}: ${c.name}`).join('\n');
}

@Injectable()
export class AnthropicAiAdapter implements AiPort {
  private readonly logger = new Logger(AnthropicAiAdapter.name);

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async extract(
    messages: AiChatMessage[],
    categories: AiCategoryOption[],
  ): Promise<AiExtractionResult> {
    const systemPrompt = `${CLARIFY_SYSTEM_PROMPT_FA}\n\nفهرست دسته‌بندی‌های معتبر:\n${categoryListForPrompt(categories)}`;

    const response = await fetch(ANTHROPIC_MESSAGES_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': ANTHROPIC_API_VERSION,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        tools: [buildExtractTool(categories)],
        tool_choice: { type: 'tool', name: EXTRACT_TOOL_NAME },
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(
        `Anthropic API error ${String(response.status)}: ${body}`,
      );
      throw new Error(`Anthropic API error: ${String(response.status)}`);
    }

    const data = (await response.json()) as AnthropicResponse;
    const toolUse = data.content.find(
      (block): block is AnthropicToolUseBlock => block.type === 'tool_use',
    );
    if (!toolUse) {
      throw new Error('Anthropic response contained no tool_use block');
    }

    const input = toolUse.input;
    const tokensUsed =
      (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0);

    return {
      raw: {
        title: input.title ?? null,
        description: input.description ?? null,
        categoryId: input.category_id ?? null,
        mode: input.mode ?? null,
        city: input.city ?? null,
        durationMinutes: input.duration_minutes ?? null,
        budgetMinRial: input.budget_min_rial ?? null,
        budgetMaxRial: input.budget_max_rial ?? null,
        missingFields: input.missing_fields ?? [],
        clarifyingQuestion: input.clarifying_question ?? null,
      },
      tokensUsed,
    };
  }
}
