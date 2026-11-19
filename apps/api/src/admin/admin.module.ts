import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CategoriesModule } from '../categories/categories.module';
import { SkillsModule } from '../skills/skills.module';
import { SmsModule } from '../auth/sms/sms.module';
import { AdminController } from './admin.controller';
import { AdminSettingsController } from './admin-settings.controller';
import { AdminSetupController } from './admin-setup.controller';
import { AdminSetupService } from './admin-setup.service';

@Module({
  imports: [AuthModule, CategoriesModule, SkillsModule, SmsModule],
  controllers: [AdminController, AdminSettingsController, AdminSetupController],
  providers: [AdminSetupService],
})
export class AdminModule {}
