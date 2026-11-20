import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ZodValidationPipe } from 'nestjs-zod';
import type {
  CreateBookingDraftInput,
  BookingIdInput,
  BookingTokenInput,
  CreateBookingInput,
  DecideBookingInput,
  UpdateBookingSettingsInput,
} from '@vaqt/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequireVerifiedPhone } from '../auth/decorators/require-verified-phone.decorator';
import type { AccessTokenPayload } from '../auth/session/token.service';
import { Public } from '../common/decorators/public.decorator';
import { BookingDraftService } from './booking-draft.service';
import { BookingService } from './booking.service';
import { BookingIdDto } from './dto/booking-id.dto';
import { BookingTokenDto } from './dto/booking-token.dto';
import { CreateBookingDraftDto } from './dto/create-booking-draft.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { DecideBookingDto } from './dto/decide-booking.dto';
import { UpdateBookingSettingsDto } from './dto/update-booking-settings.dto';

@Controller('booking')
export class BookingController {
  constructor(
    private readonly booking: BookingService,
    private readonly drafts: BookingDraftService,
  ) {}

  // ---- Provider (logged in) ----
  @Post('me/settings')
  getSettings(@CurrentUser() user: AccessTokenPayload) {
    return this.booking.getSettings(user.sub);
  }

  @Post('me/settings/update')
  updateSettings(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(UpdateBookingSettingsDto))
    body: UpdateBookingSettingsInput,
  ) {
    return this.booking.updateSettings(user.sub, body);
  }

  @Post('me/list')
  listForProvider(@CurrentUser() user: AccessTokenPayload) {
    return this.booking.listForProvider(user.sub);
  }

  @Post('me/decide')
  decide(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(DecideBookingDto)) body: DecideBookingInput,
  ) {
    return this.booking.decide(user.sub, body.id, body.action);
  }

  // ---- Booker (logged in via the normal SMS-code login) ----
  @Post('create')
  @RequireVerifiedPhone()
  create(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(CreateBookingDto)) body: CreateBookingInput,
  ) {
    return this.booking.create(user.sub, body);
  }

  @Post('mine')
  listMine(@CurrentUser() user: AccessTokenPayload) {
    return this.booking.listMine(user.sub);
  }

  // Either side of a booking.
  @Post('cancel')
  async cancel(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(BookingIdDto)) body: BookingIdInput,
  ) {
    await this.booking.cancel(user.sub, body.id);
    return { ok: true };
  }

  // ---- Public ----
  // Free slots for one service. Static segment first so it can't be read as
  // a :username.
  // Booking without an account: confirmed by sharing a phone number with the
  // Bale bot. Static segments first so they can't be read as a :username.
  @Public()
  @Post('draft')
  createDraft(
    @Body(new ZodValidationPipe(CreateBookingDraftDto))
    body: CreateBookingDraftInput,
    @Req() req: Request,
  ) {
    return this.drafts.create(body, req.ip ?? 'unknown');
  }

  @Public()
  @Get('draft/:token')
  draftStatus(@Param('token') token: string) {
    return this.drafts.status(token);
  }

  @Public()
  @Get('by-token/:token')
  getByToken(@Param('token') token: string) {
    return this.booking.getByToken(token);
  }

  @Public()
  @Post('cancel-by-token')
  cancelByToken(
    @Body(new ZodValidationPipe(BookingTokenDto)) body: BookingTokenInput,
  ) {
    return this.booking.cancelByToken(body.token);
  }

  @Public()
  @Get(':username/availability')
  availability(
    @Param('username') username: string,
    @Query('serviceId') serviceId: string | undefined,
  ) {
    return this.booking.getAvailability(username, serviceId ?? '');
  }
}
