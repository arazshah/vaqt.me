import { AnthropicAiAdapter } from './anthropic-ai.adapter';
import type { AiCategoryOption } from './ai.port';

const CATEGORIES: AiCategoryOption[] = [
  { id: 'cat_1', name: 'ترجمه' },
  { id: 'cat_2', name: 'برنامه‌نویسی' },
];

function makeAdapter(): AnthropicAiAdapter {
  return new AnthropicAiAdapter('test-api-key', 'claude-sonnet-4-5-20250929');
}

function toolUseResponse(input: Record<string, unknown>) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        content: [{ type: 'tool_use', name: 'extract_request_draft', input }],
        usage: { input_tokens: 100, output_tokens: 50 },
      }),
  };
}

describe('AnthropicAiAdapter', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('sends the tool-forced request with the dynamic category enum', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      toolUseResponse({
        title: null,
        description: null,
        category_id: null,
        mode: null,
        city: null,
        duration_minutes: null,
        budget_min_rial: null,
        budget_max_rial: null,
        missing_fields: ['title'],
        clarifying_question: 'چه کاری نیاز دارید؟',
      }),
    );
    global.fetch = fetchMock;

    await makeAdapter().extract(
      [{ role: 'user', content: 'یک برنامه‌نویس می‌خواهم' }],
      CATEGORIES,
    );

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect((init.headers as Record<string, string>)['x-api-key']).toBe(
      'test-api-key',
    );

    const body = JSON.parse(init.body as string) as {
      model: string;
      tool_choice: { type: string; name: string };
      tools: {
        input_schema: { properties: { category_id: { enum: unknown[] } } };
      }[];
      messages: { role: string; content: string }[];
      system: string;
    };
    expect(body.model).toBe('claude-sonnet-4-5-20250929');
    expect(body.tool_choice).toEqual({
      type: 'tool',
      name: 'extract_request_draft',
    });
    expect(body.tools[0].input_schema.properties.category_id.enum).toEqual([
      'cat_1',
      'cat_2',
      null,
    ]);
    expect(body.messages).toEqual([
      { role: 'user', content: 'یک برنامه‌نویس می‌خواهم' },
    ]);
    expect(body.system).toContain('cat_1: ترجمه');
    expect(body.system).toContain('cat_2: برنامه‌نویسی');
  });

  it('maps the snake_case tool input to the camelCase draft shape', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      toolUseResponse({
        title: 'ترجمه یک مقاله',
        description: 'شرح کامل کار',
        category_id: 'cat_1',
        mode: 'ONLINE',
        city: 'تهران',
        duration_minutes: 90,
        budget_min_rial: 1_000_000,
        budget_max_rial: 2_000_000,
        missing_fields: [],
        clarifying_question: null,
      }),
    );

    const result = await makeAdapter().extract(
      [{ role: 'user', content: 'ترجمه یک مقاله در تهران' }],
      CATEGORIES,
    );

    expect(result.raw).toEqual({
      title: 'ترجمه یک مقاله',
      description: 'شرح کامل کار',
      categoryId: 'cat_1',
      mode: 'ONLINE',
      city: 'تهران',
      durationMinutes: 90,
      budgetMinRial: 1_000_000,
      budgetMaxRial: 2_000_000,
      missingFields: [],
      clarifyingQuestion: null,
    });
    expect(result.tokensUsed).toBe(150);
  });

  it('throws when the API responds with a non-OK status', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('unauthorized'),
      });

    await expect(
      makeAdapter().extract([{ role: 'user', content: 'سلام' }], CATEGORIES),
    ).rejects.toThrow('Anthropic API error: 401');
  });

  it('throws when the response contains no tool_use block', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: [{ type: 'text' }] }),
    });

    await expect(
      makeAdapter().extract([{ role: 'user', content: 'سلام' }], CATEGORIES),
    ).rejects.toThrow('Anthropic response contained no tool_use block');
  });
});
