import { Body, Controller, Get, Header, Param, Post } from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
import type { SetUsernameInput, UpdateCardInput } from '@vaqt/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AccessTokenPayload } from '../auth/session/token.service';
import { Public } from '../common/decorators/public.decorator';
import { CardsService } from './cards.service';
import { SetUsernameDto } from './dto/set-username.dto';
import { UpdateCardDto } from './dto/update-card.dto';

@Controller('cards')
export class CardsController {
  constructor(private readonly cards: CardsService) {}

  // --- Owner (logged in). RPC-style @Post, same convention as the rest.
  // `me` is a reserved username, so these can never collide with /:username.
  @Post('me')
  getMine(@CurrentUser() user: AccessTokenPayload) {
    return this.cards.getMine(user.sub);
  }

  @Post('me/update')
  update(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(UpdateCardDto)) body: UpdateCardInput,
  ) {
    return this.cards.update(user.sub, body);
  }

  @Post('me/username')
  setUsername(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(SetUsernameDto)) body: SetUsernameInput,
  ) {
    return this.cards.setUsername(user.sub, body.username);
  }

  // --- Anyone (QR scans, link opens). Read-only GETs, no auth.
  @Public()
  @Get(':username')
  getPublic(@Param('username') username: string) {
    return this.cards.getPublic(username);
  }

  @Public()
  @Get(':username/vcard')
  @Header('Content-Type', 'text/vcard; charset=utf-8')
  getVCard(@Param('username') username: string) {
    const origin = process.env.WEB_ORIGIN || 'http://localhost:3000';
    return this.cards.getVCard(
      username,
      `${origin}/${encodeURIComponent(username.toLowerCase())}`,
    );
  }
}
