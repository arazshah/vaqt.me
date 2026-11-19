import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { ZodValidationPipe } from 'nestjs-zod';
import {
  loginSchema,
  registerSchema,
  type AuthMethods,
  type LoginInput,
  type RegisterInput,
} from '@vaqt/shared';
import { Public } from '../common/decorators/public.decorator';
import { AuthConfigService } from './auth.config';
import { setAuthCookies } from './auth-cookies';
import { isSmsLoginEnabled } from './guards/sms-login-enabled.guard';
import { AntiSpamService } from './password/anti-spam.service';
import { AuthService } from './auth.service';
import type { DeviceContext } from './session/session.service';

function deviceContext(req: Request): DeviceContext {
  return { userAgent: req.headers['user-agent'], ip: req.ip };
}

/** Email + password sign-up / sign-in (the default while SMS is off). */
@Controller('auth')
export class PasswordAuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly antiSpam: AntiSpamService,
    private readonly authConfig: AuthConfigService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Get('methods')
  methods(): AuthMethods {
    return { password: true, sms: isSmsLoginEnabled(this.config) };
  }

  @Public()
  @Get('register-token')
  registerToken() {
    return { token: this.antiSpam.issueFormToken() };
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.OK)
  async register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, tokens } = await this.auth.registerWithPassword(
      body,
      deviceContext(req),
    );
    setAuthCookies(res, tokens, this.authConfig);
    return { user };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, tokens } = await this.auth.loginWithPassword(
      body,
      deviceContext(req),
    );
    setAuthCookies(res, tokens, this.authConfig);
    return { user };
  }
}
