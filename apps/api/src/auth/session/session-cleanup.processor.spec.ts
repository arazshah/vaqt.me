import { SessionCleanupProcessor } from './session-cleanup.processor';
import type { SessionCleanupService } from './session-cleanup.service';

describe('SessionCleanupProcessor', () => {
  it('delegates to SessionCleanupService.cleanupOldSessions on process', async () => {
    const cleanup = {
      cleanupOldSessions: jest.fn().mockResolvedValue(3),
    } as unknown as SessionCleanupService;
    const processor = new SessionCleanupProcessor(cleanup);

    await processor.process();

    expect(cleanup.cleanupOldSessions).toHaveBeenCalledWith();
  });
});
