/**
 * Boot-time auth secret checks.
 * Error text never includes the secret value.
 */

export const KNOWN_INSECURE_SECRETS = new Set([
  'your-secret-key-change-this-in-production',
  'cookie-secret-change-this',
  'change-this-to-a-secure-random-string-in-production',
  'forum-credit-dev-kek-change-me',
]);

const MIN_SECRET_LENGTH = 32;

/**
 * @param {string | undefined | null} value
 * @returns {boolean}
 */
export function isAcceptableSecret(value) {
  if (typeof value !== 'string') return false;
  const secret = value.trim();
  if (secret.length < MIN_SECRET_LENGTH) return false;
  if (KNOWN_INSECURE_SECRETS.has(secret)) return false;
  return true;
}

/**
 * Production, development, and test all refuse a missing, short, or published secret.
 * Development keeps working when `.env` already holds a private 32+ character value.
 * COOKIE_SECRET may be omitted; it then uses the accepted JWT_SECRET.
 *
 * @param {{ nodeEnv?: string, jwtSecret?: string, cookieSecret?: string }} input
 * @returns {{ jwtSecret: string, cookieSecret: string }}
 */
export function assertRuntimeSecrets(input = {}) {
  const nodeEnv = input.nodeEnv || 'production';
  const jwtSecret = typeof input.jwtSecret === 'string' ? input.jwtSecret.trim() : '';
  const cookieInput = typeof input.cookieSecret === 'string' ? input.cookieSecret.trim() : '';
  const cookieSecret = cookieInput || jwtSecret;
  const rejected = [];
  if (!isAcceptableSecret(jwtSecret)) rejected.push('JWT_SECRET');
  if (!isAcceptableSecret(cookieSecret)) rejected.push('COOKIE_SECRET');
  if (rejected.length) {
    throw new Error(
      `Refusing to start (${nodeEnv}): ${rejected.join(' and ')} must be a private value of at least ${MIN_SECRET_LENGTH} characters`,
    );
  }
  return { jwtSecret, cookieSecret };
}
