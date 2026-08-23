import { Body, Controller, Post } from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
import { prisma } from '@vaqt/db';
import type {
  ListOffersForRequestInput,
  SelectOfferInput,
  SubmitOfferInput,
  WithdrawOfferInput,
} from '@vaqt/shared';
import type { AuthenticatedRequest } from '../auth/auth-request';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequireOwnership } from '../auth/decorators/require-ownership.decorator';
import type { AccessTokenPayload } from '../auth/session/token.service';
import { ListOffersForRequestDto } from './dto/list-offers-for-request.dto';
import { SelectOfferDto } from './dto/select-offer.dto';
import { SubmitOfferDto } from './dto/submit-offer.dto';
import { WithdrawOfferDto } from './dto/withdraw-offer.dto';
import { OffersService } from './offers.service';

@Controller('offers')
export class OffersController {
  constructor(private readonly offers: OffersService) {}

  @Post()
  submit(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(SubmitOfferDto)) body: SubmitOfferInput,
  ) {
    return this.offers.submit(user.sub, body);
  }

  @Post('select')
  @RequireOwnership(async (req: AuthenticatedRequest) => {
    const body = req.body as { offerId?: unknown } | undefined;
    const offerId = typeof body?.offerId === 'string' ? body.offerId : null;
    if (!offerId) {
      return null;
    }
    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      select: { request: { select: { ownerId: true } } },
    });
    return offer?.request.ownerId ?? null;
  })
  select(@Body(new ZodValidationPipe(SelectOfferDto)) body: SelectOfferInput) {
    return this.offers.select(body.offerId);
  }

  @Post('withdraw')
  @RequireOwnership(async (req: AuthenticatedRequest) => {
    const body = req.body as { offerId?: unknown } | undefined;
    const offerId = typeof body?.offerId === 'string' ? body.offerId : null;
    if (!offerId) {
      return null;
    }
    const offer = await prisma.offer.findUnique({
      where: { id: offerId },
      select: { providerId: true },
    });
    return offer?.providerId ?? null;
  })
  withdraw(
    @Body(new ZodValidationPipe(WithdrawOfferDto)) body: WithdrawOfferInput,
  ) {
    return this.offers.withdraw(body.offerId);
  }

  // Owner-only: who has offered on my request. Providers see their own
  // offers via /offers/mine instead, never through this endpoint.
  @Post('list')
  @RequireOwnership(async (req: AuthenticatedRequest) => {
    const body = req.body as { requestId?: unknown } | undefined;
    const requestId =
      typeof body?.requestId === 'string' ? body.requestId : null;
    if (!requestId) {
      return null;
    }
    const request = await prisma.request.findUnique({
      where: { id: requestId },
      select: { ownerId: true },
    });
    return request?.ownerId ?? null;
  })
  list(
    @Body(new ZodValidationPipe(ListOffersForRequestDto))
    body: ListOffersForRequestInput,
  ) {
    return this.offers.listForRequest(body.requestId);
  }

  @Post('mine')
  mine(@CurrentUser() user: AccessTokenPayload) {
    return this.offers.listMine(user.sub);
  }
}
