import { Injectable, Logger } from '@nestjs/common';
import { prisma } from '@vaqt/db';

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

@Injectable()
export class SessionCleanupService {
  private readonly logger = new Logger(SessionCleanupService.name);

  /**
   * Deletes Session rows that are either revoked more than 90 days ago, or
   * (never revoked but) expired more than 90 days ago. A session revoked
   * only a few days back is kept — it's still useful for reuse-detection
   * forensics shortly after the fact — only genuinely old history is swept.
   */
  async cleanupOldSessions(now: Date = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - NINETY_DAYS_MS);

    const result = await prisma.session.deleteMany({
      where: {
        OR: [
          { revokedAt: { not: null, lt: cutoff } },
          { revokedAt: null, expiresAt: { lt: cutoff } },
        ],
      },
    });

    this.logger.log(`session cleanup removed ${String(result.count)} rows`);
    return result.count;
  }
}
