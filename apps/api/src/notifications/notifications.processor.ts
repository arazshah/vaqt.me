import { Injectable, OnModuleInit } from '@nestjs/common';
import { JobsService, type JobPayload } from '../common/jobs/jobs.service';
import { NotificationDispatcher } from './notification.dispatcher';
import { NOTIFICATIONS_QUEUE } from './notification-queue.service';
import type { NotificationEvent } from './notification.types';

const SCAN_EVERY_MS = 5 * 60 * 1000;

@Injectable()
export class NotificationsProcessor implements OnModuleInit {
  constructor(
    private readonly dispatcher: NotificationDispatcher,
    private readonly jobs: JobsService,
  ) {}

  onModuleInit(): void {
    this.jobs.register(NOTIFICATIONS_QUEUE, (job) => this.process(job));
    // Idempotent (reminders are claimed with a conditional update), so it is
    // safe if several API instances each run their own timer.
    this.jobs.every('booking-reminder-scan', SCAN_EVERY_MS, () =>
      this.dispatcher.handle({ type: 'reminder.scan' }),
    );
  }

  async process(job: JobPayload): Promise<void> {
    await this.dispatcher.handle(job.payload as NotificationEvent);
  }
}
