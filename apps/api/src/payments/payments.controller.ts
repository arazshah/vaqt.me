import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ZodValidationPipe } from 'nestjs-zod';
import type { CheckoutInput } from '@vaqt/shared';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/session/token.service';
import { CheckoutDto } from './dto/checkout.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('checkout')
  checkout(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(CheckoutDto)) body: CheckoutInput,
  ) {
    return this.payments.checkout(user.sub, body);
  }

  // Zarinpal itself calls this — no session cookie is sent, so it must be
  // @Public(). It never renders anything: always a 302 redirect to the
  // web app's result page (see CLAUDE.md's payment idempotency decision).
  @Public()
  @Get('zarinpal/callback')
  async zarinpalCallback(
    @Query('Authority') authority: string | undefined,
    @Query('Status') status: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const redirectUrl = await this.payments.handleZarinpalCallback(
      authority ?? '',
      status ?? '',
    );
    res.redirect(302, redirectUrl);
  }

  @Get('order')
  getOrder(@CurrentUser() user: AccessTokenPayload, @Query('id') id: string) {
    return this.payments.getOrder(user.sub, id);
  }
}
