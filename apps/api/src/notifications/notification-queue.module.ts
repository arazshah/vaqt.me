import { Module } from '@nestjs/common';
import { NotificationQueueService } from './notification-queue.service';

// Just the producer, so BookingModule can enqueue without importing the
// dispatcher (which itself depends on BookingModule's world).
@Module({
  providers: [NotificationQueueService],
  exports: [NotificationQueueService],
})
export class NotificationQueueModule {}
