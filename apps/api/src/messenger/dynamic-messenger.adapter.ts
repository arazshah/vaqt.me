import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import { BaleAdapter } from './bale.adapter';
import type { InlineKeyboard, MessengerPort } from './messenger.port';
import { MockMessengerAdapter } from './mock-messenger.adapter';

/**
 * The MessengerPort the app actually uses: Bale on/off, and the bot token,
 * come from the admin panel and are read on every call (no restart needed).
 * "disabled" quietly does nothing, so notifications fall back to SMS.
 */
@Injectable()
export class DynamicMessengerAdapter implements MessengerPort {
  private readonly logger = new Logger(DynamicMessengerAdapter.name);
  readonly mock = new MockMessengerAdapter();

  constructor(private readonly settings: SettingsService) {}

  private async resolve(): Promise<MessengerPort | null> {
    const provider = (await this.settings.get('bale.provider')) ?? 'disabled';
    if (provider === 'bale') {
      const token = await this.settings.get('bale.botToken');
      if (!token) {
        this.logger.error(
          'bale.provider is "bale" but no bot token is set in the admin panel',
        );
        return null;
      }
      return new BaleAdapter(token);
    }
    if (provider === 'mock') {
      if (process.env.NODE_ENV === 'production') {
        this.logger.error(
          'bale.provider is "mock" in production: nothing is sent',
        );
        return null;
      }
      return this.mock;
    }
    return null;
  }

  async sendMessage(
    chatId: string,
    text: string,
    keyboard?: InlineKeyboard,
  ): Promise<void> {
    await (await this.resolve())?.sendMessage(chatId, text, keyboard);
  }

  async editMessage(
    chatId: string,
    messageId: number,
    text: string,
  ): Promise<void> {
    await (await this.resolve())?.editMessage(chatId, messageId, text);
  }

  async answerCallback(callbackId: string, text?: string): Promise<void> {
    await (await this.resolve())?.answerCallback(callbackId, text);
  }
}
