import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DynamicSmsAdapter } from './dynamic-sms.adapter';
import { SMS_PORT } from './sms.port';
import { SmsQueueService } from './sms-queue.service';
import { SmsProcessor } from './sms.processor';

@Module({
  imports: [ConfigModule],
  providers: [
    // Provider and credentials come from the admin panel at call time.
    DynamicSmsAdapter,
    { provide: SMS_PORT, useExisting: DynamicSmsAdapter },
    SmsQueueService,
    SmsProcessor,
  ],
  exports: [SmsQueueService, SMS_PORT, DynamicSmsAdapter],
})
export class SmsModule {}
