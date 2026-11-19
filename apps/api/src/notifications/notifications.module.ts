import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SmsModule } from '../auth/sms/sms.module';
import { MessengerModule } from '../messenger/messenger.module';
import { NotificationDispatcher } from './notification.dispatcher';
import { NotificationQueueModule } from './notification-queue.module';
import { NotificationsProcessor } from './notifications.processor';

@Module({
  imports: [ConfigModule, NotificationQueueModule, SmsModule, MessengerModule],
  providers: [NotificationDispatcher, NotificationsProcessor],
  exports: [NotificationDispatcher],
})
export class NotificationsModule {}
