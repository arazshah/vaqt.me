import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { BookingModule } from '../booking/booking.module';
import { BaleAdapter } from './bale.adapter';
import { BaleLinkService } from './bale-link.service';
import { BaleUpdateHandler } from './bale-update.handler';
import { DisabledMessengerAdapter } from './disabled-messenger.adapter';
import { MESSENGER_PORT, type MessengerPort } from './messenger.port';
import { MessengerController } from './messenger.controller';
import { MockMessengerAdapter } from './mock-messenger.adapter';

@Module({
  imports: [ConfigModule, AuthModule, BookingModule],
  controllers: [MessengerController],
  providers: [
    {
      provide: MESSENGER_PORT,
      useFactory: (config: ConfigService): MessengerPort => {
        const provider = config.get<string>('BALE_PROVIDER') ?? 'mock';
        if (provider === 'mock') {
          if (process.env.NODE_ENV === 'production') {
            throw new Error(
              'BALE_PROVIDER=mock is not allowed when NODE_ENV=production',
            );
          }
          return new MockMessengerAdapter();
        }
        if (provider === 'disabled') return new DisabledMessengerAdapter();
        if (provider === 'bale') {
          const token = config.get<string>('BALE_BOT_TOKEN');
          const secret = config.get<string>('BALE_WEBHOOK_SECRET');
          if (!token || !secret || secret.length < 16) {
            throw new Error(
              'BALE_BOT_TOKEN and BALE_WEBHOOK_SECRET (>= 16 chars) must be set when BALE_PROVIDER=bale',
            );
          }
          return new BaleAdapter(token);
        }
        throw new Error(`Unknown BALE_PROVIDER: ${provider}`);
      },
      inject: [ConfigService],
    },
    BaleLinkService,
    BaleUpdateHandler,
  ],
  exports: [MESSENGER_PORT, BaleLinkService],
})
export class MessengerModule {}
