import { HttpStatus } from '@nestjs/common';
import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import { ZodValidationPipe } from 'nestjs-zod';
import {
  normalizePhone,
  SystemRole,
  type SmsTestInput,
  type UpdateSettingsInput,
} from '@vaqt/shared';
import { AuditService } from '../auth/audit/audit.service';
import { SMS_PORT, type SmsPort } from '../auth/sms/sms.port';
import type { AccessTokenPayload } from '../auth/session/token.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AppError } from '../common/errors/app-error';
import { ErrorCode } from '../common/errors/error-codes';
import { maskPhone } from '../common/utils/mask-phone';
import { BaleAdapter } from '../messenger/bale.adapter';
import {
  SettingsService,
  SettingsValidationError,
} from '../settings/settings.service';
import { SmsTestDto } from './dto/sms-test.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Controller('admin/settings')
@Roles(SystemRole.ADMIN)
export class AdminSettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    @Inject(SMS_PORT) private readonly sms: SmsPort,
  ) {}

  @Post('list')
  @HttpCode(200)
  async list() {
    return { settings: await this.settings.list() };
  }

  @Post('update')
  @HttpCode(200)
  async update(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(UpdateSettingsDto)) body: UpdateSettingsInput,
  ) {
    let changed: string[];
    try {
      changed = await this.settings.update(body, user.sub);
    } catch (error) {
      if (error instanceof SettingsValidationError) {
        throw new AppError(ErrorCode.SETTING_INVALID, HttpStatus.BAD_REQUEST, {
          details: { key: error.key, reason: error.reason },
        });
      }
      throw error;
    }
    // Key names only: values may be secrets.
    if (changed.length > 0) {
      await this.audit.log({
        actorId: user.sub,
        action: 'admin.settings.update',
        entityType: 'AppSetting',
        meta: { keys: changed },
      });
    }
    return { changed, settings: await this.settings.list() };
  }

  /**
   * One button for the whole Bale hookup: verifies the token with Bale,
   * remembers the bot's username, and registers our webhook URL.
   */
  @Post('bale/connect')
  @HttpCode(200)
  async connectBale(@CurrentUser() user: AccessTokenPayload) {
    const token = await this.settings.get('bale.botToken');
    const origin = this.config.get<string>('WEB_ORIGIN');
    if (!token || !origin || !origin.startsWith('https://')) {
      throw new AppError(ErrorCode.INTEGRATION_FAILED, HttpStatus.BAD_GATEWAY);
    }
    const bale = new BaleAdapter(token);
    try {
      const me = await bale.getMe();
      const secret = await this.settings.ensureWebhookSecret(user.sub);
      await bale.setWebhook(
        `${origin}/api/v1/messenger/bale/webhook/${secret}`,
      );
      if (me.username) {
        await this.settings.update(
          { set: { 'bale.botUsername': me.username }, clear: [] },
          user.sub,
        );
      }
      await this.audit.log({
        actorId: user.sub,
        action: 'admin.bale.connected',
        entityType: 'AppSetting',
        meta: { username: me.username },
      });
      return { ok: true, username: me.username };
    } catch {
      throw new AppError(ErrorCode.INTEGRATION_FAILED, HttpStatus.BAD_GATEWAY);
    }
  }

  /** Sends one real OTP-style SMS so the admin can confirm sms.ir works. */
  @Post('sms/test')
  @HttpCode(200)
  async testSms(
    @CurrentUser() user: AccessTokenPayload,
    @Body(new ZodValidationPipe(SmsTestDto)) body: SmsTestInput,
  ) {
    const phone = normalizePhone(body.phone);
    if (!phone) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, HttpStatus.BAD_REQUEST);
    }
    const code = String(10000 + Math.floor(Math.random() * 90000));
    const result = await this.sms.sendOtp(phone, code);
    await this.audit.log({
      actorId: user.sub,
      action: 'admin.sms.test',
      meta: { phone: maskPhone(phone), delivered: result.delivered },
    });
    return { delivered: result.delivered };
  }
}
