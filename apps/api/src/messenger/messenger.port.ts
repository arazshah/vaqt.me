export interface InlineButton {
  text: string;
  callbackData: string;
}
/** Rows of inline buttons shown under a message. */
export type InlineKeyboard = InlineButton[][];

export const MESSENGER_PORT = Symbol('MESSENGER_PORT');

/**
 * A chat messenger we can push notifications to (today: Bale). Telegram and
 * WhatsApp are deliberately not implemented: servers hosted in Iran can't
 * reach them.
 */
export interface MessengerPort {
  sendMessage(
    chatId: string,
    text: string,
    keyboard?: InlineKeyboard,
  ): Promise<void>;
  /** Replaces a message's text and removes its buttons. */
  editMessage(chatId: string, messageId: number, text: string): Promise<void>;
  answerCallback(callbackId: string, text?: string): Promise<void>;
}
