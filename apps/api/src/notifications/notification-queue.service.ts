import { Injectable, Logger } from '@nestjs/common';
import { JobsService } from '../common/jobs/jobs.service';
import type { NotificationEvent } from './notification.types';

export const NOTIFICATIONS_QUEUE = 'notifications';

@Injectable()
export class NotificationQueueService {
  private readonly logger = new Logger(NotificationQueueService.name);

  constructor(private readonly jobs: JobsService) {}

  /**
   * Enqueues and returns. A queue failure is logged and swallowed: a booking
   * must never fail (or roll back) because a notification couldn't be queued.
   */
  async enqueue(event: NotificationEvent): Promise<void> {
    try {
      await this.jobs.enqueue(NOTIFICATIONS_QUEUE, event.type, event);
    } catch (error) {
      this.logger.error(`failed to enqueue ${event.type}`, error);
    }
  }
}
