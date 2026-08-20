import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import { setAuthCookies, clearAuthCookies } from './auth-cookies';
import { AuthConfigService } from './auth.config';
import { CurrentUser } from './decorators/current-user.decorator';
import { RequestOtpDto } from './dto/request-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import type { AccessTokenPayload } from './session/token.service';
import type { DeviceContext } from './session/session.service';

function deviceContext(req: Request): DeviceContext {
  return { userAgent: req.headers['user-agent'], ip: req.ip };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: AuthConfigService,
  ) {}

  @Public()
  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  requestOtp(@Body() dto: RequestOtpDto, @Ip() ip: string) {
    return this.auth.requestOtp(dto.phone, ip);
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, tokens } = await this.auth.verifyOtp(
      dto.phone,
      dto.code,
      deviceContext(req),
    );
    setAuthCookies(res, tokens, this.config);
    return { user };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = (req.cookies as Record<string, string> | undefined)
      ?.refresh_token;
    if (!refreshToken) {
      throw new UnauthorizedException();
    }
    const tokens = await this.auth.refresh(refreshToken, deviceContext(req));
    setAuthCookies(res, tokens, this.config);
    return { ok: true };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: AccessTokenPayload,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logout(user.sub, user.sid);
    clearAuthCookies(res);
    return { ok: true };
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(
    @CurrentUser() user: AccessTokenPayload,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.logoutAll(user.sub);
    clearAuthCookies(res);
    return { ok: true };
  }

  @Get('me')
  getMe(@CurrentUser() user: AccessTokenPayload) {
    return this.auth.getMe(user.sub);
  }

  @Patch('role')
  updateRole(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.auth.updateRole(user.sub, dto.roleIntent);
  }

  @Post('ws-ticket')
  @HttpCode(HttpStatus.OK)
  createWsTicket(@CurrentUser() user: AccessTokenPayload) {
    return this.auth.createWsTicket(user.sub);
  }
}
