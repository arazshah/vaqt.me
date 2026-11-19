import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodValidationPipe } from 'nestjs-zod';
import type { SetupClaimInput } from '@vaqt/shared';
import { setAuthCookies } from '../auth/auth-cookies';
import { AuthConfigService } from '../auth/auth.config';
import { SessionService } from '../auth/session/session.service';
import { Public } from '../common/decorators/public.decorator';
import { AdminSetupService } from './admin-setup.service';
import { SetupClaimDto } from './dto/setup-claim.dto';

// Public on purpose: it exists for the moment before any admin (and so any
// login) exists. Everything it does is gated by the one-time server-log token
// and turns itself off as soon as an admin exists.
@Controller('admin/setup')
export class AdminSetupController {
  constructor(
    private readonly setup: AdminSetupService,
    private readonly sessions: SessionService,
    private readonly authConfig: AuthConfigService,
  ) {}

  @Public()
  @Post('status')
  @HttpCode(200)
  async status() {
    return { needsSetup: await this.setup.needsSetup() };
  }

  @Public()
  @Post('claim')
  @HttpCode(200)
  async claim(
    @Body(new ZodValidationPipe(SetupClaimDto)) body: SetupClaimInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { tokens } = await this.setup.claim(
      body,
      { userAgent: req.headers['user-agent'], ip: req.ip },
      this.sessions,
    );
    setAuthCookies(res, tokens, this.authConfig);
    return { ok: true };
  }
}
