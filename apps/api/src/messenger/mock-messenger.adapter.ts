import { Injectable, Logger } from '@nestjs/common';
import type { InlineKeyboard, MessengerPort } from './messenger.port';

export interface MockSentMessage {
  chatId: string;
  text: string;
  keyboard?: InlineKeyboard;
  contactButton?: string;
}

/** Records messages in memory so tests and local dev can inspect them. */
@Injectable()
export class MockMessengerAdapter implements MessengerPort {
  private readonly logger = new Logger(MockMessengerAdapter.name);
  readonly sent: MockSentMessage[] = [];
  readonly edits: { chatId: string; messageId: number; text: string }[] = [];
  readonly callbackAnswers: { callbackId: string; text?: string }[] = [];

  sendMessage(
    chatId: string,
    text: string,
    keyboard?: InlineKeyboard,
  ): Promise<void> {
    this.sent.push({ chatId, text, keyboard });
    this.logger.log(`[mock-bale] -> chat ${chatId}: ${text.split('\n')[0]}`);
    return Promise.resolve();
  }

  sendContactRequest(
    chatId: string,
    text: string,
    buttonText: string,
  ): Promise<void> {
    this.sent.push({ chatId, text, contactButton: buttonText });
    return Promise.resolve();
  }

  editMessage(chatId: string, messageId: number, text: string): Promise<void> {
    this.edits.push({ chatId, messageId, text });
    return Promise.resolve();
  }

  answerCallback(callbackId: string, text?: string): Promise<void> {
    this.callbackAnswers.push({ callbackId, text });
    return Promise.resolve();
  }
}
