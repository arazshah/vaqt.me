import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { SmsModule } from '../auth/sms/sms.module';
import { MessengerModule } from '../messenger/messenger.module';
import { NotificationDispatcher } from './notification.dispatcher';
import { NotificationQueueModule } from './notification-queue.module';
import { NotificationsProcessor } from './notifications.processor';
import type { NotificationEvent } from './notification.types';

const SCAN_EVERY_MS = 5 * 60 * 1000;

@Module({
  imports: [ConfigModule, NotificationQueueModule, SmsModule, MessengerModule],
  providers: [NotificationDispatcher, NotificationsProcessor],
  exports: [NotificationDispatcher],
})
export class NotificationsModule implements OnModuleInit {
  constructor(@InjectQueue('notifications') private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    // Idempotent by scheduler id, safe on every boot (same as session-cleanup).
    const event: NotificationEvent = { type: 'reminder.scan' };
    await this.queue.upsertJobScheduler(
      'booking-reminder-scan',
      { every: SCAN_EVERY_MS },
      {
        name: 'reminder.scan',
        data: event,
        opts: { removeOnComplete: { count: 20 }, removeOnFail: { count: 50 } },
      },
    );
  }
}
