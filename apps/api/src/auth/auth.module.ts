import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuthConfigService } from './auth.config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuditService } from './audit/audit.service';
import { OtpService } from './otp/otp.service';
import { OtpPendingCodeStore } from './otp/otp-pending-code.store';
import { RateLimitService } from './rate-limit/rate-limit.service';
import { SessionCleanupModule } from './session/session-cleanup.module';
import { SessionService } from './session/session.service';
import { TokenService } from './session/token.service';
import { SmsModule } from './sms/sms.module';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RequireVerifiedPhoneGuard } from './guards/require-verified-phone.guard';
import { RequireOwnershipGuard } from './guards/require-ownership.guard';

@Module({
  imports: [
    ConfigModule,
    JwtModule.register({}),
    SmsModule,
    SessionCleanupModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthConfigService,
    AuthService,
    AuditService,
    OtpService,
    OtpPendingCodeStore,
    RateLimitService,
    SessionService,
    TokenService,
    JwtAuthGuard,
    RequireVerifiedPhoneGuard,
    RequireOwnershipGuard,
  ],
  exports: [JwtAuthGuard, AuthConfigService],
})
export class AuthModule {}
