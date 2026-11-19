import { createHash, timingSafeEqual } from 'crypto';
import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/session/token.service';
import { Public } from '../common/decorators/public.decorator';
import { AppError } from '../common/errors/app-error';
import { SettingsService } from '../settings/settings.service';
import { ErrorCode } from '../common/errors/error-codes';
import { BaleLinkService } from './bale-link.service';
import { BaleUpdateHandler, type BaleUpdate } from './bale-update.handler';

const sha256 = (v: string) => createHash('sha256').update(v).digest();

@Controller('messenger/bale')
export class MessengerController {
  constructor(
    private readonly links: BaleLinkService,
    private readonly handler: BaleUpdateHandler,
    private readonly settings: SettingsService,
  ) {}

  // ---- Owner (logged in) ----
  @Post('status')
  async status(@CurrentUser() user: AccessTokenPayload) {
    return {
      bound: await this.links.isBound(user.sub),
      botUsername: (await this.settings.get('bale.botUsername')) ?? null,
    };
  }

  @Post('link')
  link(@CurrentUser() user: AccessTokenPayload) {
    return this.links.createLinkCode(user.sub);
  }

  @Post('unlink')
  async unlink(@CurrentUser() user: AccessTokenPayload) {
    await this.links.unlink(user.sub);
    return { ok: true };
  }

  // ---- Bale's servers ----
  // Authenticated only by the secret in the path (Bale sends no signature
  // header and no browser Origin; see the origin-check exemption in main.ts).
  // Any wrong or missing secret looks like a route that doesn't exist.
  @Public()
  @Post('webhook/:secret')
  @HttpCode(200)
  async webhook(@Param('secret') secret: string, @Body() update: BaleUpdate) {
    const expected = await this.settings.get('bale.webhookSecret');
    if (!expected || !timingSafeEqual(sha256(secret), sha256(expected))) {
      throw new AppError(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    await this.handler.handle(update);
    return { ok: true };
  }
}
