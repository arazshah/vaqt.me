import { Injectable, Logger } from '@nestjs/common';
import { JobsService } from '../../common/jobs/jobs.service';
import type { NotificationSmsJobData, OtpSmsJobData } from './sms-job.types';

export const SMS_QUEUE = 'sms';

@Injectable()
export class SmsQueueService {
  private readonly logger = new Logger(SmsQueueService.name);

  constructor(private readonly jobs: JobsService) {}

  /**
   * Enqueues and returns — never awaits delivery. A queue failure is caught
   * and logged, never allowed to fail the HTTP response for
   * /auth/otp/request.
   */
  async enqueueOtp(data: OtpSmsJobData): Promise<void> {
    try {
      await this.jobs.enqueue(SMS_QUEUE, 'otp', data);
    } catch (error) {
      this.logger.error('failed to enqueue otp sms job', error);
    }
  }

  async enqueueNotification(data: NotificationSmsJobData): Promise<void> {
    try {
      await this.jobs.enqueue(SMS_QUEUE, 'notification', data);
    } catch (error) {
      this.logger.error('failed to enqueue notification sms job', error);
    }
  }
}
