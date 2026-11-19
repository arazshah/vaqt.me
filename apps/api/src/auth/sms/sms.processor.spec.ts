import type { JobsService } from '../../common/jobs/jobs.service';
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
    return {
      processor: new SmsProcessor(smsPort, {
        register: jest.fn(),
      } as unknown as JobsService),
      smsPort,
    };
  }

  it('dispatches an "otp" job to sendOtp', async () => {
    const { processor, smsPort } = makeProcessor();
    const job = {
      name: 'otp',
      payload: { phone: '+989123456789', code: '12345' },
    };

    await processor.process(job);

    expect(smsPort.sendOtp).toHaveBeenCalledWith('+989123456789', '12345');
    expect(smsPort.sendNotification).not.toHaveBeenCalled();
  });

  it('dispatches a "notification" job to sendNotification', async () => {
    const { processor, smsPort } = makeProcessor();
    const job = {
      name: 'notification',
      payload: { phone: '+989123456789', templateId: '42', params: { a: 'b' } },
    };

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
    const job = { name: 'something-else', payload: {} };

    await processor.process(job);

    expect(smsPort.sendOtp).not.toHaveBeenCalled();
    expect(smsPort.sendNotification).not.toHaveBeenCalled();
  });
});
