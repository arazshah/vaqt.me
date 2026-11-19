import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Prisma, prisma } from '@vaqt/db';
import { KvService } from '../kv/kv.service';

// Postgres-backed background jobs (replaces BullMQ/Redis). Jobs are rows
// claimed with FOR UPDATE SKIP LOCKED, so several API instances can share the
// table safely. Failed jobs retry with exponential backoff; a job whose
// worker died mid-run is picked up again after STALE_AFTER_MS.
const NOW_UTC = Prisma.sql`(now() AT TIME ZONE 'UTC')`;
const POLL_EVERY_MS = 1000;
const STALE_AFTER_MS = 5 * 60 * 1000;
const BASE_BACKOFF_MS = 2000;
const DEFAULT_MAX_ATTEMPTS = 3;
const FAILED_KEEP_MS = 7 * 24 * 60 * 60 * 1000;

export interface JobPayload {
  name: string;
  payload: unknown;
}
export type JobHandler = (job: JobPayload) => Promise<void>;

interface ClaimedJob {
  id: string;
  queue: string;
  name: string;
  payload: unknown;
  attempts: number;
  maxAttempts: number;
}

@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobsService.name);
  private readonly handlers = new Map<string, JobHandler>();
  private readonly timers: NodeJS.Timeout[] = [];
  private polling = false;

  constructor(private readonly kv: KvService) {}

  /** Adds a job. Callers that must not fail on a queue error catch it themselves. */
  async enqueue(
    queue: string,
    name: string,
    payload: unknown,
    opts: { delayMs?: number; maxAttempts?: number } = {},
  ): Promise<void> {
    const delaySeconds = (opts.delayMs ?? 0) / 1000;
    await prisma.$executeRaw`
      INSERT INTO jobs ("id", "queue", "name", "payload", "maxAttempts", "runAt")
      VALUES (${randomId()}, ${queue}, ${name}, ${JSON.stringify(payload)}::jsonb,
        ${opts.maxAttempts ?? DEFAULT_MAX_ATTEMPTS},
        ${NOW_UTC} + make_interval(secs => ${delaySeconds}::double precision))`;
  }

  /** Registers the handler that processes a queue's jobs. */
  register(queue: string, handler: JobHandler): void {
    this.handlers.set(queue, handler);
  }

  /** Runs `fn` every `intervalMs` in this process (idempotent work only). */
  every(name: string, intervalMs: number, fn: () => Promise<void>): void {
    const timer = setInterval(() => {
      fn().catch((error: unknown) => {
        this.logger.error(`scheduled task "${name}" failed`, error);
      });
    }, intervalMs);
    timer.unref();
    this.timers.push(timer);
  }

  onModuleInit(): void {
    if (process.env.JOBS_WORKER === 'off') return;
    const poll = setInterval(() => {
      this.runDue().catch((error: unknown) => {
        this.logger.error('job poll failed', error);
      });
    }, POLL_EVERY_MS);
    poll.unref();
    this.timers.push(poll);
    this.every('housekeeping', 10 * 60 * 1000, () => this.housekeeping());
  }

  onModuleDestroy(): void {
    for (const timer of this.timers.splice(0)) clearInterval(timer);
  }

  /** Claims and processes due jobs once. Returns how many ran. */
  async runDue(limit = 10): Promise<number> {
    const queues = [...this.handlers.keys()];
    if (queues.length === 0 || this.polling) return 0;
    this.polling = true;
    try {
      const jobs = await prisma.$queryRaw<ClaimedJob[]>`
        UPDATE jobs SET "status" = 'RUNNING', "lockedAt" = ${NOW_UTC}, "attempts" = "attempts" + 1
        WHERE "id" IN (
          SELECT "id" FROM jobs
          WHERE "queue" = ANY(${queues}) AND (
            ("status" = 'PENDING' AND "runAt" <= ${NOW_UTC})
            OR ("status" = 'RUNNING' AND "lockedAt" < ${NOW_UTC} - make_interval(secs => ${STALE_AFTER_MS / 1000}::double precision))
          )
          ORDER BY "runAt" LIMIT ${limit} FOR UPDATE SKIP LOCKED)
        RETURNING "id", "queue", "name", "payload", "attempts", "maxAttempts"`;
      for (const job of jobs) await this.process(job);
      return jobs.length;
    } finally {
      this.polling = false;
    }
  }

  private async process(job: ClaimedJob): Promise<void> {
    const handler = this.handlers.get(job.queue);
    try {
      if (!handler) throw new Error(`no handler for queue ${job.queue}`);
      await handler({ name: job.name, payload: job.payload });
      await prisma.$executeRaw`DELETE FROM jobs WHERE "id" = ${job.id}`;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (job.attempts >= job.maxAttempts) {
        this.logger.error(
          `job ${job.queue}/${job.name} failed for good: ${message}`,
        );
        await prisma.$executeRaw`
          UPDATE jobs SET "status" = 'FAILED', "lastError" = ${message} WHERE "id" = ${job.id}`;
        return;
      }
      const backoff = (BASE_BACKOFF_MS * 2 ** (job.attempts - 1)) / 1000;
      this.logger.warn(
        `job ${job.queue}/${job.name} failed (attempt ${String(job.attempts)}): ${message}`,
      );
      await prisma.$executeRaw`
        UPDATE jobs SET "status" = 'PENDING', "lastError" = ${message},
          "runAt" = ${NOW_UTC} + make_interval(secs => ${backoff}::double precision)
        WHERE "id" = ${job.id}`;
    }
  }

  async housekeeping(): Promise<void> {
    await this.kv.purgeExpired();
    await prisma.$executeRaw`
      DELETE FROM jobs WHERE "status" = 'FAILED'
        AND "createdAt" < ${NOW_UTC} - make_interval(secs => ${FAILED_KEEP_MS / 1000}::double precision)`;
  }
}

function randomId(): string {
  return `job_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}
