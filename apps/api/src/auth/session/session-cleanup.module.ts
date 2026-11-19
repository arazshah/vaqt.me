import { Module, OnModuleInit } from '@nestjs/common';
import { JobsService } from '../../common/jobs/jobs.service';
import { SessionCleanupService } from './session-cleanup.service';

const CLEANUP_EVERY_MS = 6 * 60 * 60 * 1000;

@Module({
  providers: [SessionCleanupService],
  exports: [SessionCleanupService],
})
export class SessionCleanupModule implements OnModuleInit {
  constructor(
    private readonly jobs: JobsService,
    private readonly cleanup: SessionCleanupService,
  ) {}

  onModuleInit(): void {
    // Deleting old sessions is idempotent, so a plain timer is enough.
    this.jobs.every('session-cleanup', CLEANUP_EVERY_MS, () =>
      this.cleanup.cleanupOldSessions().then(() => undefined),
    );
  }
}
