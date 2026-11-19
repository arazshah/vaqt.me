import { Global, Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { PrismaSettingsStore, SETTINGS_STORE } from './settings.store';

@Global()
@Module({
  providers: [
    SettingsService,
    { provide: SETTINGS_STORE, useClass: PrismaSettingsStore },
  ],
  exports: [SettingsService],
})
export class SettingsModule {}
