import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { prisma } from '@vaqt/db';
import { normalizePhone, type CreateBookingDraftInput } from '@vaqt/shared';
import { BookingDraftService } from '../booking/booking-draft.service';
import { BookingService } from '../booking/booking.service';
import { AppError } from '../common/errors/app-error';
import { KvService } from '../common/kv/kv.service';
import { errorMessagesFa } from '../common/messages/fa';
import { formatWhen } from '../notifications/format';
import { BaleLinkService } from './bale-link.service';
import { MESSENGER_PORT, type MessengerPort } from './messenger.port';
import { baleMessagesFa as msg } from './messenger.messages.fa';

export interface BaleContact {
  phone_number?: string;
  user_id?: number | string;
}

const PENDING_TTL_SECONDS = 600;

/** Booking confirmed inside the Bale bot, without a website account. */
@Injectable()
export class BaleBookingFlow {
  constructor(
    private readonly links: BaleLinkService,
    private readonly booking: BookingService,
    private readonly drafts: BookingDraftService,
    private readonly kv: KvService,
    private readonly config: ConfigService,
    @Inject(MESSENGER_PORT) private readonly messenger: MessengerPort,
  ) {}

  private pendingKey(chat: string) {
    return this.kv.key('bale-draft-pending', chat);
  }

  /** /start bk_<token> */
  async onStart(chat: string, token: string): Promise<void> {
    const draft = await this.drafts.peek(token);
    if (!draft) {
      await this.messenger.sendMessage(chat, msg.draftInvalid);
      return;
    }
    const provider = await prisma.user.findUnique({
      where: { username: draft.username.toLowerCase() },
      select: { displayName: true },
    });
    const service = await prisma.serviceType.findUnique({
      where: { id: draft.serviceId },
      select: { name: true },
    });
    const summary = msg.draftSummary({
      provider: provider?.displayName ?? '',
      service: service?.name ?? '',
      when: formatWhen(new Date(draft.startAt)),
      name: draft.name,
    });
    const userId = await this.links.findUserIdByChat(chat);
    if (userId) {
      await this.messenger.sendMessage(
        chat,
        summary + msg.confirmBookingPrompt,
        [[{ text: msg.confirmBookingButton, callbackData: `bd:${token}` }]],
      );
      return;
    }
    await this.kv.set(this.pendingKey(chat), token, PENDING_TTL_SECONDS);
    await this.messenger.sendContactRequest(
      chat,
      summary + msg.shareContactPrompt,
      msg.shareContactButton,
    );
  }

  /** The user tapped the share-phone button. */
  async onContact(
    chat: string,
    senderId: string,
    contact: BaleContact,
  ): Promise<void> {
    const token = await this.kv.get(this.pendingKey(chat));
    if (!token) {
      await this.messenger.sendMessage(chat, msg.contactWithoutDraft);
      return;
    }
    // Only the sender's own number counts, never a forwarded contact card.
    if (contact.user_id === undefined || String(contact.user_id) !== senderId) {
      await this.messenger.sendMessage(chat, msg.contactNotOwn);
      return;
    }
    const raw = contact.phone_number ?? '';
    const phone = normalizePhone(raw) ?? normalizePhone(`+${raw}`);
    if (!phone) {
      await this.messenger.sendMessage(chat, msg.contactInvalid);
      return;
    }
    const draft = await this.drafts.consume(token);
    await this.kv.del(this.pendingKey(chat));
    if (!draft) {
      await this.messenger.sendMessage(chat, msg.draftInvalid);
      return;
    }
    const now = new Date();
    const user =
      (await prisma.user.findUnique({ where: { phone } })) ??
      (await prisma.user.create({
        data: {
          phone,
          displayName: draft.name,
          phoneVerifiedAt: now,
          lastSeenAt: now,
        },
      }));
    if (user.status !== 'ACTIVE') {
      await this.messenger.sendMessage(chat, msg.genericError);
      return;
    }
    if (!user.phoneVerifiedAt) {
      await prisma.user.update({
        where: { id: user.id },
        data: { phoneVerifiedAt: now },
      });
    }
    await this.finalize(chat, token, draft, user.id);
  }

  /** Callback bd:<token> from an already-linked chat. */
  async onConfirm(chat: string, token: string): Promise<string | null> {
    const userId = await this.links.findUserIdByChat(chat);
    if (!userId) return msg.notLinked;
    const draft = await this.drafts.consume(token);
    if (!draft) return msg.draftInvalid;
    await this.finalize(chat, token, draft, userId);
    return null;
  }

  private async finalize(
    chat: string,
    token: string,
    draft: CreateBookingDraftInput,
    userId: string,
  ): Promise<void> {
    try {
      const booking = await this.booking.create(userId, draft);
      await this.links.bindIfFree(userId, chat);
      await this.drafts.storeResult(token, booking.cancelToken);
      const origin =
        this.config.get<string>('WEB_ORIGIN') ?? 'http://localhost:3000';
      await this.messenger.sendMessage(
        chat,
        msg.bookingCreated(`${origin}/b/${booking.cancelToken}`),
        [[{ text: msg.cancelButton, callbackData: `bk:x:${booking.id}` }]],
      );
    } catch (error) {
      const text =
        error instanceof AppError
          ? errorMessagesFa[error.code]
          : msg.genericError;
      await this.messenger.sendMessage(chat, text);
    }
  }
}
