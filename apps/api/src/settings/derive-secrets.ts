import { hkdfSync } from 'crypto';

export const MIN_APP_SECRET_LENGTH = 32;

// Each secret gets its own label, so leaking one derived value reveals nothing
// about the others or about APP_SECRET itself.
const DERIVED: Record<string, string> = {
  OTP_PEPPER: 'otp-pepper-v1',
  JWT_ACCESS_SECRET: 'jwt-access-v1',
  JWT_REFRESH_SECRET: 'jwt-refresh-v1',
};

/**
 * Lets a deployment provide ONE secret (APP_SECRET) instead of four. Anything
 * set explicitly in the environment is left alone, so older deployments and
 * local dev keep working unchanged. Mutates and returns `env`.
 */
export function deriveMissingSecrets(
  env: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  const master = env.APP_SECRET;
  if (!master || master.length < MIN_APP_SECRET_LENGTH) return env;
  for (const [name, label] of Object.entries(DERIVED)) {
    if (!env[name]) {
      env[name] = Buffer.from(
        hkdfSync('sha256', master, 'vaqt-app', label, 32),
      ).toString('hex');
    }
  }
  return env;
}
