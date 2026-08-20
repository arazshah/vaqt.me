import type { Queue } from 'bullmq';
import { SmsQueueService } from './sms-queue.service';

describe('SmsQueueService', () => {
  function makeService(): {
    service: SmsQueueService;
    queue: jest.Mocked<Pick<Queue, 'add'>>;
  } {
    const queue = { add: jest.fn().mockResolvedValue(undefined) };
    return { service: new SmsQueueService(queue as unknown as Queue), queue };
  }

  it('enqueueOtp adds an "otp" job with the given payload', async () => {
    const { service, queue } = makeService();
    await service.enqueueOtp({ phone: '+989123456789', code: '12345' });
    expect(queue.add).toHaveBeenCalledWith('otp', {
      phone: '+989123456789',
      code: '12345',
    });
  });

  it('enqueueNotification adds a "notification" job with the given payload', async () => {
    const { service, queue } = makeService();
    await service.enqueueNotification({
      phone: '+989123456789',
      templateId: '42',
      params: { a: 'b' },
    });
    expect(queue.add).toHaveBeenCalledWith('notification', {
      phone: '+989123456789',
      templateId: '42',
      params: { a: 'b' },
    });
  });

  it('enqueueOtp swallows a queue failure instead of throwing (must never block the HTTP response)', async () => {
    const queue = { add: jest.fn().mockRejectedValue(new Error('redis down')) };
    const service = new SmsQueueService(queue as unknown as Queue);
    await expect(
      service.enqueueOtp({ phone: '+989123456789', code: '12345' }),
    ).resolves.toBeUndefined();
  });

  it('enqueueNotification swallows a queue failure instead of throwing', async () => {
    const queue = { add: jest.fn().mockRejectedValue(new Error('redis down')) };
    const service = new SmsQueueService(queue as unknown as Queue);
    await expect(
      service.enqueueNotification({
        phone: '+989123456789',
        templateId: '1',
        params: {},
      }),
    ).resolves.toBeUndefined();
  });
});
