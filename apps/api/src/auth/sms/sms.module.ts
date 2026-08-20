import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { MockSmsAdapter } from './mock-sms.adapter';
import { SmsIrAdapter } from './sms-ir.adapter';
import { SMS_PORT, type SmsPort } from './sms.port';
import { SmsQueueService } from './sms-queue.service';
import { SmsProcessor } from './sms.processor';

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({
      name: 'sms',
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    }),
  ],
  providers: [
    {
      provide: SMS_PORT,
      useFactory: (config: ConfigService): SmsPort => {
        const provider = config.get<string>('SMS_PROVIDER') ?? 'mock';

        if (provider === 'mock') {
          if (process.env.NODE_ENV === 'production') {
            throw new Error(
              'SMS_PROVIDER=mock is not allowed when NODE_ENV=production',
            );
          }
          return new MockSmsAdapter();
        }

        if (provider === 'smsir') {
          return new SmsIrAdapter(config);
        }

        throw new Error(`Unknown SMS_PROVIDER: ${provider}`);
      },
      inject: [ConfigService],
    },
    SmsQueueService,
    SmsProcessor,
  ],
  exports: [SmsQueueService],
})
export class SmsModule {}
