import { Inject, Injectable, Logger } from '@nestjs/common';
import { prisma } from '@vaqt/db';
import { BookingService } from '../booking/booking.service';
import { AppError } from '../common/errors/app-error';
import { ErrorCode } from '../common/errors/error-codes';
import { BaleBookingFlow, type BaleContact } from './bale-booking.flow';
import { BaleLinkService } from './bale-link.service';
import { MESSENGER_PORT, type MessengerPort } from './messenger.port';
import { baleMessagesFa as msg } from './messenger.messages.fa';

// Subset of Bale's Update object (same shape as Telegram's) that we use.
export interface BaleUpdate {
  message?: {
    chat?: { id?: number | string };
    from?: { id?: number | string };
    text?: string;
    contact?: BaleContact;
  };
  callback_query?: {
    id?: string;
    data?: string;
    message?: {
      message_id?: number;
      text?: string;
      chat?: { id?: number | string };
    };
  };
}

const CALLBACK_RE = /^bk:([crx]):([A-Za-z0-9_-]{10,40})$/;
const DRAFT_CALLBACK_RE = /^bd:([A-Za-z0-9_-]{16,40})$/;
const DRAFT_START_PREFIX = 'bk_';

@Injectable()
export class BaleUpdateHandler {
  private readonly logger = new Logger(BaleUpdateHandler.name);

  constructor(
    private readonly links: BaleLinkService,
    private readonly booking: BookingService,
    private readonly flow: BaleBookingFlow,
    @Inject(MESSENGER_PORT) private readonly messenger: MessengerPort,
  ) {}

  /** Never throws: Bale retries a failed webhook, which we don't want. */
  async handle(update: BaleUpdate): Promise<void> {
    try {
      if (update.callback_query) {
        await this.handleCallback(update.callback_query);
      } else if (update.message) {
        await this.handleMessage(update.message);
      }
    } catch (error) {
      this.logger.error('failed to handle bale update', error);
    }
  }

  private async handleMessage(message: NonNullable<BaleUpdate['message']>) {
    const chatId = message.chat?.id;
    if (chatId === undefined) return;
    const chat = String(chatId);
    if (message.contact) {
      await this.flow.onContact(
        chat,
        String(message.from?.id ?? chatId),
        message.contact,
      );
      return;
    }
    const text = message.text?.trim();
    if (!text) return;

    const start = /^\/start(?:\s+(\S+))?$/i.exec(text);
    const payload = start ? start[1] : text; // bare code is accepted too
    const startPayload: string | undefined = start?.[1];
    if (startPayload?.startsWith(DRAFT_START_PREFIX)) {
      await this.flow.onStart(
        chat,
        startPayload.slice(DRAFT_START_PREFIX.length),
      );
      return;
    }
    if (!payload || /^\/start$/i.test(payload)) {
      await this.messenger.sendMessage(chat, msg.help);
      return;
    }

    const userId = await this.links.completeLink(payload, chat);
    if (!userId) {
      await this.messenger.sendMessage(chat, msg.linkInvalid);
      return;
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { displayName: true },
    });
    await this.messenger.sendMessage(chat, msg.linked(user?.displayName ?? ''));
  }

  private async handleCallback(cb: NonNullable<BaleUpdate['callback_query']>) {
    const callbackId = cb.id;
    const chatId = cb.message?.chat?.id;
    const messageId = cb.message?.message_id;
    const draftMatch = DRAFT_CALLBACK_RE.exec(cb.data ?? '');
    if (callbackId && chatId !== undefined && draftMatch) {
      const problem = await this.flow.onConfirm(String(chatId), draftMatch[1]);
      await this.messenger.answerCallback(callbackId, problem ?? undefined);
      return;
    }
    const match = CALLBACK_RE.exec(cb.data ?? '');
    if (!callbackId || chatId === undefined || !match) return;
    const chat = String(chatId);

    // The chat -> user binding is the ONLY identity here, and booking.decide
    // additionally requires that user to be the booking's provider.
    const userId = await this.links.findUserIdByChat(chat);
    if (!userId) {
      await this.messenger.answerCallback(callbackId, msg.notLinked);
      return;
    }
    const original = cb.message?.text ?? '';
    if (match[1] === 'x') {
      try {
        await this.booking.cancel(userId, match[2]);
        if (messageId !== undefined) {
          await this.messenger.editMessage(
            chat,
            messageId,
            original + msg.canceled,
          );
        }
        await this.messenger.answerCallback(callbackId);
      } catch {
        await this.messenger.answerCallback(callbackId, msg.notCancellable);
      }
      return;
    }
    const action = match[1] === 'c' ? 'confirm' : 'reject';
    try {
      await this.booking.decide(userId, match[2], action);
      if (messageId !== undefined) {
        await this.messenger.editMessage(
          chat,
          messageId,
          original +
            (action === 'confirm' ? msg.decidedConfirm : msg.decidedReject),
        );
      }
      await this.messenger.answerCallback(callbackId);
    } catch (error) {
      const reason =
        error instanceof AppError &&
        error.code === ErrorCode.BOOKING_NOT_PENDING
          ? msg.notPending
          : msg.genericError;
      await this.messenger.answerCallback(callbackId, reason);
    }
  }
}
