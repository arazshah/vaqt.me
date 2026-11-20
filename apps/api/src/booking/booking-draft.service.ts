import { randomBytes } from 'crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import {
  createBookingDraftSchema,
  type BookingDraftOfferView,
  type BookingDraftStatusView,
  type CreateBookingDraftInput,
} from '@vaqt/shared';
import { AppError } from '../common/errors/app-error';
import { ErrorCode } from '../common/errors/error-codes';
import { KvService } from '../common/kv/kv.service';
import { SettingsService } from '../settings/settings.service';
import { BookingService } from './booking.service';

export const DRAFT_TTL_SECONDS = 600;
export const DRAFT_START_PREFIX = 'bk_';
const DRAFT_TOKEN_RE = /^[A-Za-z0-9_-]{16,40}$/;
const IP_WINDOW_MS = 600_000;
const IP_LIMIT = 10;

/**
 * A booking waiting for its booker to confirm it in the Bale bot. The draft
 * holds no slot: availability is checked again when the booking is created.
 */
@Injectable()
export class BookingDraftService {
  constructor(
    private readonly kv: KvService,
    private readonly settings: SettingsService,
    private readonly booking: BookingService,
  ) {}

  private draftKey(token: string) {
    return this.kv.key('booking-draft', token);
  }
  private resultKey(token: string) {
    return this.kv.key('booking-draft-result', token);
  }

  async create(
    input: CreateBookingDraftInput,
    ip: string,
  ): Promise<BookingDraftOfferView> {
    const bot = await this.settings.get('bale.botUsername');
    const provider = (await this.settings.get('bale.provider')) ?? 'disabled';
    if (!bot || provider === 'disabled') {
      throw new AppError(
        ErrorCode.BALE_NOT_CONFIGURED,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    const [allowed] = await this.kv.slidingWindow(
      this.kv.key('booking-draft-ip', ip),
      Date.now(),
      IP_WINDOW_MS,
      IP_LIMIT,
    );
    if (!allowed) {
      throw new AppError(
        ErrorCode.TOO_MANY_ATTEMPTS,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    await this.booking.assertSlotFree(input);
    const token = randomBytes(16).toString('base64url');
    await this.kv.set(
      this.draftKey(token),
      JSON.stringify(input),
      DRAFT_TTL_SECONDS,
    );
    return {
      token,
      url: `https://ble.ir/${bot}?start=${DRAFT_START_PREFIX}${token}`,
      expiresInSeconds: DRAFT_TTL_SECONDS,
    };
  }

  private parse(raw: string | null): CreateBookingDraftInput | null {
    if (!raw) return null;
    try {
      const parsed = createBookingDraftSchema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  async peek(token: string): Promise<CreateBookingDraftInput | null> {
    if (!DRAFT_TOKEN_RE.test(token)) return null;
    return this.parse(await this.kv.get(this.draftKey(token)));
  }

  /** Single use: a draft can become at most one booking. */
  async consume(token: string): Promise<CreateBookingDraftInput | null> {
    if (!DRAFT_TOKEN_RE.test(token)) return null;
    return this.parse(await this.kv.getAndDelete(this.draftKey(token)));
  }

  async storeResult(token: string, cancelToken: string): Promise<void> {
    await this.kv.set(this.resultKey(token), cancelToken, DRAFT_TTL_SECONDS);
  }

  async status(token: string): Promise<BookingDraftStatusView> {
    if (!DRAFT_TOKEN_RE.test(token)) return { status: 'expired' };
    const result = await this.kv.get(this.resultKey(token));
    if (result) return { status: 'done', cancelToken: result };
    const draft = await this.kv.get(this.draftKey(token));
    return { status: draft ? 'waiting' : 'expired' };
  }
}
