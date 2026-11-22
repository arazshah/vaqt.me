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
import { SettingsService } from '../settings/settings.service';
import { AppError } from '../common/errors/app-error';
import { ErrorCode } from '../common/errors/error-codes';
import type { Request, Response } from 'express';
import { ZodValidationPipe } from 'nestjs-zod';
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  type AuthMethods,
  type ChangePasswordInput,
  type LoginInput,
  type RegisterInput,
} from '@vaqt/shared';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AccessTokenPayload } from './session/token.service';
import { AuthConfigService } from './auth.config';
import { setAuthCookies } from './auth-cookies';
import { isSmsLoginEnabled } from './guards/sms-login-enabled.guard';
import { AntiSpamService } from './password/anti-spam.service';
import { AuthService } from './auth.service';
import type { DeviceContext } from './session/session.service';

function deviceContext(req: Request): DeviceContext {
  return { userAgent: req.headers['user-agent'], ip: req.ip };
}

/** Legacy password sign-in; new accounts must use SMS. */
@Controller('auth')
export class PasswordAuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly antiSpam: AntiSpamService,
    private readonly authConfig: AuthConfigService,
    private readonly settings: SettingsService,
  ) {}

  @Public()
  @Get('methods')
  async methods(): Promise<AuthMethods> {
    return { password: true, sms: await isSmsLoginEnabled(this.settings) };
  }

  @Public()
  @Get('register-token')
  registerToken() {
    return { token: this.antiSpam.issueFormToken() };
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.OK)
  register(@Body(new ZodValidationPipe(registerSchema)) _body: RegisterInput) {
    throw new AppError(
      ErrorCode.SMS_REGISTRATION_REQUIRED,
      HttpStatus.FORBIDDEN,
    );
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

  /** Signed-in users only (no @Public): change the account's password. */
  @Post('password/change')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() current: AccessTokenPayload,
    @Body(new ZodValidationPipe(changePasswordSchema))
    body: ChangePasswordInput,
  ) {
    const user = await this.auth.changePassword(current.sub, current.sid, body);
    return { user };
  }
}
