import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import type { NotificationSmsJobData, OtpSmsJobData } from './sms-job.types';

@Injectable()
export class SmsQueueService {
  private readonly logger = new Logger(SmsQueueService.name);

  constructor(@InjectQueue('sms') private readonly queue: Queue) {}

  /**
   * Enqueues and returns — never awaits delivery. A queue failure (e.g.
   * Redis briefly unavailable) is caught and logged, never allowed to fail
   * the HTTP response for /auth/otp/request.
   */
  async enqueueOtp(data: OtpSmsJobData): Promise<void> {
    try {
      await this.queue.add('otp', data);
    } catch (error) {
      this.logger.error('failed to enqueue otp sms job', error);
    }
  }

  async enqueueNotification(data: NotificationSmsJobData): Promise<void> {
    try {
      await this.queue.add('notification', data);
    } catch (error) {
      this.logger.error('failed to enqueue notification sms job', error);
    }
  }
}
