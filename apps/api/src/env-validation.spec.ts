import {
  collectEnvValidationFailures,
  validateEnvOrExit,
} from './env-validation';

const VALID_ENV: NodeJS.ProcessEnv = {
  NODE_ENV: 'development',
  OTP_PEPPER: 'a'.repeat(32),
  JWT_ACCESS_SECRET: 'b'.repeat(32),
  JWT_REFRESH_SECRET: 'c'.repeat(32),
  DATABASE_URL: 'postgresql://vaqt:vaqt@localhost:5432/vaqt',
  REDIS_URL: 'redis://localhost:6380',
};

describe('collectEnvValidationFailures', () => {
  it('returns no failures for a fully valid env', () => {
    expect(collectEnvValidationFailures(VALID_ENV)).toEqual([]);
  });

  it('rejects a missing OTP_PEPPER', () => {
    const { OTP_PEPPER: _omit, ...rest } = VALID_ENV;
    const failures = collectEnvValidationFailures(rest);
    expect(failures.some((f) => f.path === 'OTP_PEPPER')).toBe(true);
  });

  it('rejects an OTP_PEPPER shorter than 32 characters', () => {
    const failures = collectEnvValidationFailures({
      ...VALID_ENV,
      OTP_PEPPER: 'short',
    });
    expect(failures.some((f) => f.path === 'OTP_PEPPER')).toBe(true);
  });

  it('rejects a JWT_ACCESS_SECRET shorter than 32 characters', () => {
    const failures = collectEnvValidationFailures({
      ...VALID_ENV,
      JWT_ACCESS_SECRET: 'short',
    });
    expect(failures.some((f) => f.path === 'JWT_ACCESS_SECRET')).toBe(true);
  });

  it('rejects a JWT_REFRESH_SECRET shorter than 32 characters', () => {
    const failures = collectEnvValidationFailures({
      ...VALID_ENV,
      JWT_REFRESH_SECRET: 'short',
    });
    expect(failures.some((f) => f.path === 'JWT_REFRESH_SECRET')).toBe(true);
  });

  it('rejects a missing DATABASE_URL', () => {
    const { DATABASE_URL: _omit, ...rest } = VALID_ENV;
    const failures = collectEnvValidationFailures(rest);
    expect(failures.some((f) => f.path === 'DATABASE_URL')).toBe(true);
  });

  it('rejects a missing REDIS_URL', () => {
    const { REDIS_URL: _omit, ...rest } = VALID_ENV;
    const failures = collectEnvValidationFailures(rest);
    expect(failures.some((f) => f.path === 'REDIS_URL')).toBe(true);
  });

  it('outside production, a placeholder value fails only the length rule, not a placeholder-specific rule', () => {
    // The real .env.example placeholders are all under 32 characters, so
    // they already fail the length rule everywhere. This test isolates the
    // placeholder-equality rule by checking that outside production the
    // *only* failure for this field is the generic length message — no
    // second, placeholder-specific failure is added — proving that rule is
    // production-gated rather than always active.
    const failures = collectEnvValidationFailures({
      ...VALID_ENV,
      NODE_ENV: 'development',
      OTP_PEPPER: 'change-me-in-production',
    });
    const otpFailures = failures.filter((f) => f.path === 'OTP_PEPPER');
    expect(otpFailures).toHaveLength(1);
    expect(otpFailures[0].message).toBe('باید حداقل 32 کاراکتر باشد');
  });

  it('rejects the OTP_PEPPER placeholder value in production', () => {
    const failures = collectEnvValidationFailures({
      ...VALID_ENV,
      NODE_ENV: 'production',
      OTP_PEPPER: 'change-me-in-production',
    });
    expect(failures.some((f) => f.path === 'OTP_PEPPER')).toBe(true);
  });

  it('rejects the JWT_ACCESS_SECRET placeholder value in production', () => {
    const failures = collectEnvValidationFailures({
      ...VALID_ENV,
      NODE_ENV: 'production',
      JWT_ACCESS_SECRET: 'your-access-secret-change-in-production',
    });
    expect(failures.some((f) => f.path === 'JWT_ACCESS_SECRET')).toBe(true);
  });

  it('rejects the JWT_REFRESH_SECRET placeholder value in production', () => {
    const failures = collectEnvValidationFailures({
      ...VALID_ENV,
      NODE_ENV: 'production',
      JWT_REFRESH_SECRET: 'your-refresh-secret-change-in-production',
    });
    expect(failures.some((f) => f.path === 'JWT_REFRESH_SECRET')).toBe(true);
  });

  it('accepts real (non-placeholder) secrets in production', () => {
    const failures = collectEnvValidationFailures({
      ...VALID_ENV,
      NODE_ENV: 'production',
    });
    expect(failures).toEqual([]);
  });

  it('reports every failure at once, not just the first', () => {
    const failures = collectEnvValidationFailures({
      NODE_ENV: 'production',
    });
    const paths = failures.map((f) => f.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        'OTP_PEPPER',
        'JWT_ACCESS_SECRET',
        'JWT_REFRESH_SECRET',
        'DATABASE_URL',
        'REDIS_URL',
      ]),
    );
  });
});

describe('validateEnvOrExit', () => {
  it('does not exit or log when the env is valid', () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit should not have been called');
    });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();

    expect(() => {
      validateEnvOrExit(VALID_ENV);
    }).not.toThrow();
    expect(exitSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('logs every failure and exits with code 1 when the env is invalid', () => {
    const exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation();

    validateEnvOrExit({ NODE_ENV: 'production' });

    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalled();
    const loggedText = errorSpy.mock.calls
      .map((call) => String(call[0]))
      .join('\n');
    expect(loggedText).toContain('OTP_PEPPER');

    exitSpy.mockRestore();
    errorSpy.mockRestore();
  });
});
