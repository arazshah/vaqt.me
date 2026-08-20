import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { VerifyOtpDto } from './verify-otp.dto';

describe('VerifyOtpDto', () => {
  it('accepts a valid phone + numeric code', async () => {
    const dto = plainToInstance(VerifyOtpDto, {
      phone: '09123456789',
      code: '12345',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a code with letters', async () => {
    const dto = plainToInstance(VerifyOtpDto, {
      phone: '09123456789',
      code: '1234a',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a code shorter than 4 digits', async () => {
    const dto = plainToInstance(VerifyOtpDto, {
      phone: '09123456789',
      code: '123',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a code longer than 8 digits', async () => {
    const dto = plainToInstance(VerifyOtpDto, {
      phone: '09123456789',
      code: '123456789',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a missing code', async () => {
    const dto = plainToInstance(VerifyOtpDto, { phone: '09123456789' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
