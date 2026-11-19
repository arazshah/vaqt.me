import { prisma } from '@vaqt/db';
import { randomUUID } from 'node:crypto';
import { KvService } from '../kv/kv.service';
import { JobsService } from './jobs.service';

describe('JobsService (real Postgres)', () => {
  const queue = `test-${randomUUID()}`;
  let jobs: JobsService;

  beforeEach(() => {
    jobs = new JobsService(new KvService());
  });

  afterEach(async () => {
    jobs.onModuleDestroy();
    await prisma.job.deleteMany({ where: { queue } });
  });

  it('runs an enqueued job once and removes it', async () => {
    const seen: unknown[] = [];
    jobs.register(queue, (job) => {
      seen.push([job.name, job.payload]);
      return Promise.resolve();
    });
    await jobs.enqueue(queue, 'hello', { n: 1 });
    expect(await jobs.runDue()).toBe(1);
    expect(seen).toEqual([['hello', { n: 1 }]]);
    expect(await jobs.runDue()).toBe(0);
    expect(await prisma.job.count({ where: { queue } })).toBe(0);
  });

  it('does not run delayed jobs early', async () => {
    jobs.register(queue, () => Promise.resolve());
    await jobs.enqueue(queue, 'later', {}, { delayMs: 60_000 });
    expect(await jobs.runDue()).toBe(0);
    expect(await prisma.job.count({ where: { queue } })).toBe(1);
  });

  it('retries a failing job with backoff, then marks it FAILED', async () => {
    const handler = jest.fn().mockRejectedValue(new Error('boom'));
    jobs.register(queue, handler);
    await jobs.enqueue(queue, 'bad', {}, { maxAttempts: 2 });

    expect(await jobs.runDue()).toBe(1);
    let row = await prisma.job.findFirstOrThrow({ where: { queue } });
    expect(row.status).toBe('PENDING');
    expect(row.attempts).toBe(1);
    expect(row.lastError).toBe('boom');
    expect(await jobs.runDue()).toBe(0); // backing off

    await prisma.job.update({
      where: { id: row.id },
      data: { runAt: new Date(Date.now() - 1000) },
    });
    expect(await jobs.runDue()).toBe(1);
    row = await prisma.job.findFirstOrThrow({ where: { queue } });
    expect(row.status).toBe('FAILED');
    expect(row.attempts).toBe(2);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('recovers a job whose worker died mid-run', async () => {
    const handler = jest.fn().mockResolvedValue(undefined);
    jobs.register(queue, handler);
    await jobs.enqueue(queue, 'orphan', {});
    await prisma.job.updateMany({
      where: { queue },
      data: { status: 'RUNNING', lockedAt: new Date(Date.now() - 10 * 60_000) },
    });
    expect(await jobs.runDue()).toBe(1);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('two workers never run the same job twice', async () => {
    const handler = jest.fn().mockResolvedValue(undefined);
    const other = new JobsService(new KvService());
    jobs.register(queue, handler);
    other.register(queue, handler);
    for (let i = 0; i < 6; i++) await jobs.enqueue(queue, 'job', { i });
    const [a, b] = await Promise.all([jobs.runDue(), other.runDue()]);
    expect(a + b).toBe(6);
    expect(handler).toHaveBeenCalledTimes(6);
  });

  it('jobs for queues without a handler are left alone', async () => {
    jobs.register(`${queue}-other`, () => Promise.resolve());
    await jobs.enqueue(queue, 'x', {});
    expect(await jobs.runDue()).toBe(0);
    expect(await prisma.job.count({ where: { queue } })).toBe(1);
  });

  it('housekeeping deletes old FAILED jobs but keeps recent ones', async () => {
    await prisma.job.createMany({
      data: [
        {
          queue,
          name: 'old',
          payload: {},
          status: 'FAILED',
          createdAt: new Date(Date.now() - 30 * 86_400_000),
        },
        { queue, name: 'new', payload: {}, status: 'FAILED' },
      ],
    });
    await jobs.housekeeping();
    const names = (await prisma.job.findMany({ where: { queue } })).map(
      (j) => j.name,
    );
    expect(names).toEqual(['new']);
  });
});
