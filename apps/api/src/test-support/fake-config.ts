import type { ConfigService } from '@nestjs/config';

// @nestjs/config's real ConfigService checks process.env BEFORE the object
// passed to its constructor (see ConfigService.get -> getFromProcessEnv),
// so `new ConfigService({ FOO: 'bar' })` silently falls through to whatever
// FOO happens to be in the ambient shell/CI environment — a real risk here
// since this app's own env var names (OTP_PEPPER, JWT_ACCESS_SECRET, ...)
// are exactly what a developer or CI runner is likely to already have
// exported. This fake reads only from the supplied object, nothing else,
// so tests stay deterministic regardless of the ambient environment.
export function fakeConfig(values: Record<string, string>): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}
