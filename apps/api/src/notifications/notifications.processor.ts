import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { NotificationDispatcher } from './notification.dispatcher';
import type { NotificationEvent } from './notification.types';

@Processor('notifications')
export class NotificationsProcessor extends WorkerHost {
  constructor(private readonly dispatcher: NotificationDispatcher) {
    super();
  }

  async process(job: Job<NotificationEvent>): Promise<void> {
    await this.dispatcher.handle(job.data);
  }
}
