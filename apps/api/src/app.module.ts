import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AdminModule } from './admin/admin.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { BookingModule } from './booking/booking.module';
import { CardsModule } from './cards/cards.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { JobsModule } from './common/jobs/jobs.module';
import { KvModule } from './common/kv/kv.module';
import { MessengerModule } from './messenger/messenger.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SettingsModule } from './settings/settings.module';
import { WalletModule } from './wallet/wallet.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    KvModule,
    JobsModule,
    SettingsModule,
    AuthModule,
    UsersModule,
    AdminModule,
    CardsModule,
    BookingModule,
    MessengerModule,
    NotificationsModule,
    WalletModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useExisting: JwtAuthGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
