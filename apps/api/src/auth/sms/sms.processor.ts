import { Inject } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { SMS_PORT, type SmsPort } from './sms.port';
import type { SmsJobData } from './sms-job.types';

@Processor('sms')
export class SmsProcessor extends WorkerHost {
  constructor(@Inject(SMS_PORT) private readonly smsPort: SmsPort) {
    super();
  }

  async process(job: Job<SmsJobData>): Promise<void> {
    if (job.name === 'otp') {
      const data = job.data as { phone: string; code: string };
      await this.smsPort.sendOtp(data.phone, data.code);
      return;
    }

    if (job.name === 'notification') {
      const data = job.data as {
        phone: string;
        templateId: string;
        params: Record<string, string>;
      };
      await this.smsPort.sendNotification(
        data.phone,
        data.templateId,
        data.params,
      );
    }
  }
}
