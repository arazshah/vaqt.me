import type { JobsService } from '../../common/jobs/jobs.service';
import { SmsQueueService } from './sms-queue.service';

describe('SmsQueueService', () => {
  function makeService(enqueue = jest.fn().mockResolvedValue(undefined)) {
    const jobs = { enqueue } as unknown as JobsService;
    return { service: new SmsQueueService(jobs), enqueue };
  }

  it('enqueueOtp adds an "otp" job on the sms queue', async () => {
    const { service, enqueue } = makeService();
    await service.enqueueOtp({ phone: '+989123456789', code: '12345' });
    expect(enqueue).toHaveBeenCalledWith('sms', 'otp', {
      phone: '+989123456789',
      code: '12345',
    });
  });

  it('enqueueNotification adds a "notification" job on the sms queue', async () => {
    const { service, enqueue } = makeService();
    await service.enqueueNotification({
      phone: '+989123456789',
      templateId: '42',
      params: { a: 'b' },
    });
    expect(enqueue).toHaveBeenCalledWith('sms', 'notification', {
      phone: '+989123456789',
      templateId: '42',
      params: { a: 'b' },
    });
  });

  it('enqueueOtp swallows a queue failure (must never block the HTTP response)', async () => {
    const { service } = makeService(
      jest.fn().mockRejectedValue(new Error('db down')),
    );
    await expect(
      service.enqueueOtp({ phone: '+989123456789', code: '12345' }),
    ).resolves.toBeUndefined();
  });

  it('enqueueNotification swallows a queue failure', async () => {
    const { service } = makeService(
      jest.fn().mockRejectedValue(new Error('db down')),
    );
    await expect(
      service.enqueueNotification({
        phone: '+989123456789',
        templateId: '1',
        params: {},
      }),
    ).resolves.toBeUndefined();
  });
});
