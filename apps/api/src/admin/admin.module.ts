import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SmsModule } from '../auth/sms/sms.module';
import { AdminSettingsController } from './admin-settings.controller';
import { AdminSetupService } from './admin-setup.service';

@Module({
  imports: [AuthModule, SmsModule],
  controllers: [AdminSettingsController],
  providers: [AdminSetupService],
})
export class AdminModule {}
