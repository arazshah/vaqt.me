import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { DynamicSmsAdapter } from './dynamic-sms.adapter';
import { SMS_PORT } from './sms.port';
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
    // Provider and credentials come from the admin panel at call time.
    { provide: SMS_PORT, useClass: DynamicSmsAdapter },
    SmsQueueService,
    SmsProcessor,
  ],
  exports: [SmsQueueService, SMS_PORT],
})
export class SmsModule {}
