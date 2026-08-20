import { Processor, WorkerHost } from '@nestjs/bullmq';
import { SessionCleanupService } from './session-cleanup.service';

@Processor('session-cleanup')
export class SessionCleanupProcessor extends WorkerHost {
  constructor(private readonly cleanup: SessionCleanupService) {
    super();
  }

  async process(): Promise<void> {
    await this.cleanup.cleanupOldSessions();
  }
}
