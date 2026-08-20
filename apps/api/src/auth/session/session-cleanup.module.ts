import { Module, OnModuleInit } from '@nestjs/common';
import { BullModule, InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { SessionCleanupProcessor } from './session-cleanup.processor';
import { SessionCleanupService } from './session-cleanup.service';

const DAILY_AT_3AM_CRON = '0 3 * * *';
const REPEATABLE_JOB_ID = 'daily-session-cleanup';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'session-cleanup',
      defaultJobOptions: {
        removeOnComplete: { count: 30 },
        removeOnFail: { count: 100 },
      },
    }),
  ],
  providers: [SessionCleanupService, SessionCleanupProcessor],
  exports: [SessionCleanupService],
})
export class SessionCleanupModule implements OnModuleInit {
  constructor(@InjectQueue('session-cleanup') private readonly queue: Queue) {}

  async onModuleInit(): Promise<void> {
    // upsertJobScheduler is idempotent by schedulerId — safe to call on
    // every boot without creating duplicate repeatable jobs.
    await this.queue.upsertJobScheduler(
      REPEATABLE_JOB_ID,
      { pattern: DAILY_AT_3AM_CRON },
      { name: 'cleanup' },
    );
  }
}
