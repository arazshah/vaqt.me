import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CategoriesModule } from '../categories/categories.module';
import { SkillsModule } from '../skills/skills.module';
import { AdminController } from './admin.controller';

@Module({
  imports: [AuthModule, CategoriesModule, SkillsModule],
  controllers: [AdminController],
})
export class AdminModule {}
