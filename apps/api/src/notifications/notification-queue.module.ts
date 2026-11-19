import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationQueueService } from './notification-queue.service';

// Just the queue + producer, so BookingModule can enqueue without importing
// the dispatcher (which itself depends on BookingModule's world).
@Module({
  imports: [
    BullModule.registerQueue({
      name: 'notifications',
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    }),
  ],
  providers: [NotificationQueueService],
  exports: [BullModule, NotificationQueueService],
})
export class NotificationQueueModule {}
