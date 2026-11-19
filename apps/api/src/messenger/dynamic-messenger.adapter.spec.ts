import type { SettingsService } from '../settings/settings.service';
import { DynamicMessengerAdapter } from './dynamic-messenger.adapter';

function make(values: Record<string, string>) {
  return new DynamicMessengerAdapter({
    get: (k: string) => Promise.resolve(values[k]),
  } as unknown as SettingsService);
}

describe('DynamicMessengerAdapter', () => {
  const originalFetch = global.fetch;
  const originalEnv = process.env.NODE_ENV;
  afterEach(() => {
    global.fetch = originalFetch;
    process.env.NODE_ENV = originalEnv;
  });

  it('does nothing when disabled or unset, so callers fall back to SMS', async () => {
    global.fetch = jest.fn();
    await make({ 'bale.provider': 'disabled' }).sendMessage('1', 'hi');
    await make({}).answerCallback('cb');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('records messages in the mock outside production only', async () => {
    process.env.NODE_ENV = 'development';
    const adapter = make({ 'bale.provider': 'mock' });
    await adapter.sendMessage('chat1', 'hello');
    expect(adapter.mock.sent).toEqual([
      { chatId: 'chat1', text: 'hello', keyboard: undefined },
    ]);
    process.env.NODE_ENV = 'production';
    const prod = make({ 'bale.provider': 'mock' });
    await prod.sendMessage('chat1', 'hello');
    expect(prod.mock.sent).toHaveLength(0);
  });

  it('does not call Bale without a token, and uses the panel token when present', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ ok: true }),
    });
    global.fetch = fetchMock;
    await make({ 'bale.provider': 'bale' }).sendMessage('1', 'x');
    expect(fetchMock).not.toHaveBeenCalled();
    await make({
      'bale.provider': 'bale',
      'bale.botToken': '9:TOKEN',
    }).sendMessage('1', 'x', [[{ text: 'ok', callbackData: 'a' }]]);
    const [url, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(url).toBe('https://tapi.bale.ai/bot9:TOKEN/sendMessage');
    expect(JSON.parse(init.body)).toMatchObject({
      reply_markup: { inline_keyboard: [[{ text: 'ok', callback_data: 'a' }]] },
    });
  });
});
