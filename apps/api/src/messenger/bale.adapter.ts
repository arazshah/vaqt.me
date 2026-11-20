import { Injectable } from '@nestjs/common';
import type { InlineKeyboard, MessengerPort } from './messenger.port';

const BALE_API = 'https://tapi.bale.ai';
const REQUEST_TIMEOUT_MS = 10_000;

interface BaleResponse {
  ok: boolean;
  description?: string;
  result?: unknown;
}

/**
 * Bale Bot API (https://docs.bale.ai) — same shape as Telegram's Bot API.
 * NOT yet verified against the live service: no bot token existed while this
 * was written. Verify sendMessage, inline buttons and callbacks with a real
 * token before relying on it in production.
 */
@Injectable()
export class BaleAdapter implements MessengerPort {
  constructor(private readonly token: string) {}

  private async call(
    method: string,
    body: Record<string, unknown>,
  ): Promise<unknown> {
    const res = await fetch(`${BALE_API}/bot${this.token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const data = (await res
      .json()
      .catch(() => ({ ok: false }))) as BaleResponse;
    if (!res.ok || !data.ok) {
      // Never include the URL (it contains the token) in the error.
      throw new Error(
        `Bale ${method} failed: ${String(res.status)} ${data.description ?? ''}`.trim(),
      );
    }
    return data.result;
  }

  async sendMessage(
    chatId: string,
    text: string,
    keyboard?: InlineKeyboard,
  ): Promise<void> {
    await this.call('sendMessage', {
      chat_id: chatId,
      text,
      ...(keyboard && {
        reply_markup: {
          inline_keyboard: keyboard.map((row) =>
            row.map((b) => ({ text: b.text, callback_data: b.callbackData })),
          ),
        },
      }),
    });
  }

  async sendContactRequest(
    chatId: string,
    text: string,
    buttonText: string,
  ): Promise<void> {
    await this.call('sendMessage', {
      chat_id: chatId,
      text,
      reply_markup: {
        keyboard: [[{ text: buttonText, request_contact: true }]],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    });
  }

  async editMessage(
    chatId: string,
    messageId: number,
    text: string,
  ): Promise<void> {
    await this.call('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
    });
  }

  async answerCallback(callbackId: string, text?: string): Promise<void> {
    await this.call('answerCallbackQuery', {
      callback_query_id: callbackId,
      ...(text && { text }),
    });
  }

  /** Checks the token works and returns the bot's @username. */
  async getMe(): Promise<{ username: string | null }> {
    const result = (await this.call('getMe', {})) as
      { username?: string } | undefined;
    return { username: result?.username ?? null };
  }

  /** Tells Bale where to POST updates (our webhook URL, secret included). */
  async setWebhook(url: string): Promise<void> {
    await this.call('setWebhook', { url });
  }
}
