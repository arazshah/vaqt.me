import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { JobsService, type JobPayload } from '../../common/jobs/jobs.service';
import { SMS_PORT, type SmsPort } from './sms.port';
import { SMS_QUEUE } from './sms-queue.service';
import type { NotificationSmsJobData, OtpSmsJobData } from './sms-job.types';

@Injectable()
export class SmsProcessor implements OnModuleInit {
  constructor(
    @Inject(SMS_PORT) private readonly smsPort: SmsPort,
    private readonly jobs: JobsService,
  ) {}

  onModuleInit(): void {
    this.jobs.register(SMS_QUEUE, (job) => this.process(job));
  }

  async process(job: JobPayload): Promise<void> {
    if (job.name === 'otp') {
      const data = job.payload as OtpSmsJobData;
      await this.smsPort.sendOtp(data.phone, data.code);
      return;
    }

    if (job.name === 'notification') {
      const data = job.payload as NotificationSmsJobData;
      await this.smsPort.sendNotification(
        data.phone,
        data.templateId,
        data.params,
      );
    }
  }
}
