import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { BookingModule } from '../booking/booking.module';
import { BaleLinkService } from './bale-link.service';
import { BaleUpdateHandler } from './bale-update.handler';
import { DynamicMessengerAdapter } from './dynamic-messenger.adapter';
import { MESSENGER_PORT } from './messenger.port';
import { MessengerController } from './messenger.controller';

@Module({
  imports: [ConfigModule, AuthModule, BookingModule],
  controllers: [MessengerController],
  providers: [
    // Provider and token come from the admin panel at call time.
    { provide: MESSENGER_PORT, useClass: DynamicMessengerAdapter },
    BaleLinkService,
    BaleUpdateHandler,
  ],
  exports: [MESSENGER_PORT, BaleLinkService],
})
export class MessengerModule {}
