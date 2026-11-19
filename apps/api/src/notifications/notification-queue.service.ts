import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import type { NotificationEvent } from './notification.types';

@Injectable()
export class NotificationQueueService {
  private readonly logger = new Logger(NotificationQueueService.name);

  constructor(@InjectQueue('notifications') private readonly queue: Queue) {}

  /**
   * Enqueues and returns. A queue failure is logged and swallowed: a booking
   * must never fail (or roll back) because a notification couldn't be queued.
   */
  async enqueue(event: NotificationEvent): Promise<void> {
    try {
      await this.queue.add(event.type, event);
    } catch (error) {
      this.logger.error(`failed to enqueue ${event.type}`, error);
    }
  }
}
