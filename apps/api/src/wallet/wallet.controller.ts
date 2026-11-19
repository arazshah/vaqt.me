import { Body, Controller, Post } from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
import type { WalletTargetInput } from '@vaqt/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequireVerifiedPhone } from '../auth/decorators/require-verified-phone.decorator';
import type { AccessTokenPayload } from '../auth/session/token.service';
import { WalletTargetDto } from './dto/wallet-target.dto';
import { WalletService } from './wallet.service';

@Controller('wallet')
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Post('list')
  list(@CurrentUser() user: AccessTokenPayload) {
    return this.wallet.list(user.sub);
  }

  @Post('status')
  status(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(WalletTargetDto)) body: WalletTargetInput,
  ) {
    return this.wallet.status(user.sub, body.username);
  }

  @Post('save')
  save(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(WalletTargetDto)) body: WalletTargetInput,
  ) {
    return this.wallet.save(user.sub, body.username);
  }

  @Post('exchange')
  @RequireVerifiedPhone()
  exchange(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(WalletTargetDto)) body: WalletTargetInput,
  ) {
    return this.wallet.exchange(user.sub, body.username);
  }

  @Post('remove')
  async remove(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(WalletTargetDto)) body: WalletTargetInput,
  ) {
    await this.wallet.remove(user.sub, body.username);
    return { ok: true };
  }
}
