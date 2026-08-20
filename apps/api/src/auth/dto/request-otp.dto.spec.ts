import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RequestOtpDto } from './request-otp.dto';

describe('RequestOtpDto', () => {
  it('accepts a non-empty string phone', async () => {
    const dto = plainToInstance(RequestOtpDto, { phone: '09123456789' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a missing phone', async () => {
    const dto = plainToInstance(RequestOtpDto, {});
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a non-string phone', async () => {
    const dto = plainToInstance(RequestOtpDto, { phone: 123 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
