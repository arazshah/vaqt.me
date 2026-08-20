import type { Job } from 'bullmq';
import type { SmsJobData } from './sms-job.types';
import type { SmsPort } from './sms.port';
import { SmsProcessor } from './sms.processor';

describe('SmsProcessor', () => {
  function makeProcessor(): {
    processor: SmsProcessor;
    smsPort: jest.Mocked<SmsPort>;
  } {
    const smsPort: jest.Mocked<SmsPort> = {
      sendOtp: jest.fn().mockResolvedValue({ delivered: true }),
      sendNotification: jest.fn().mockResolvedValue({ delivered: true }),
    };
    return { processor: new SmsProcessor(smsPort), smsPort };
  }

  it('dispatches an "otp" job to sendOtp', async () => {
    const { processor, smsPort } = makeProcessor();
    const job = {
      name: 'otp',
      data: { phone: '+989123456789', code: '12345' },
    } as unknown as Job<SmsJobData>;

    await processor.process(job);

    expect(smsPort.sendOtp).toHaveBeenCalledWith('+989123456789', '12345');
    expect(smsPort.sendNotification).not.toHaveBeenCalled();
  });

  it('dispatches a "notification" job to sendNotification', async () => {
    const { processor, smsPort } = makeProcessor();
    const job = {
      name: 'notification',
      data: { phone: '+989123456789', templateId: '42', params: { a: 'b' } },
    } as unknown as Job<SmsJobData>;

    await processor.process(job);

    expect(smsPort.sendNotification).toHaveBeenCalledWith(
      '+989123456789',
      '42',
      { a: 'b' },
    );
    expect(smsPort.sendOtp).not.toHaveBeenCalled();
  });

  it('ignores an unrecognized job name', async () => {
    const { processor, smsPort } = makeProcessor();
    const job = {
      name: 'something-else',
      data: {},
    } as unknown as Job<SmsJobData>;

    await processor.process(job);

    expect(smsPort.sendOtp).not.toHaveBeenCalled();
    expect(smsPort.sendNotification).not.toHaveBeenCalled();
  });
});
