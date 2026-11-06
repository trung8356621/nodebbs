import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { assertRuntimeSecrets, isAcceptableSecret } from './runtime-secrets.js';

const strong = 'a'.repeat(48);

describe('runtime auth secrets', () => {
  it('rejects missing, short, and published defaults in production', () => {
    for (const jwtSecret of ['', 'short', 'your-secret-key-change-this-in-production']) {
      assert.throws(
        () => assertRuntimeSecrets({ nodeEnv: 'production', jwtSecret, cookieSecret: strong }),
        /JWT_SECRET/,
      );
    }
    assert.throws(
      () => assertRuntimeSecrets({ nodeEnv: 'production', jwtSecret: strong, cookieSecret: 'cookie-secret-change-this' }),
      /COOKIE_SECRET/,
    );
  });

  it('does not include the secret value in the error', () => {
    const secret = `published-${'b'.repeat(40)}`;
    try {
      assertRuntimeSecrets({ nodeEnv: 'production', jwtSecret: 'your-secret-key-change-this-in-production' });
      assert.fail('expected throw');
    } catch (error) {
      assert.equal(error.message.includes('your-secret-key-change-this-in-production'), false);
      assert.equal(error.message.includes(secret), false);
    }
  });

  it('accepts a private development secret and defaults cookie to JWT', () => {
    const resolved = assertRuntimeSecrets({ nodeEnv: 'development', jwtSecret: strong });
    assert.equal(resolved.jwtSecret, strong);
    assert.equal(resolved.cookieSecret, strong);
  });

  it('treats an unset node env as production', () => {
    assert.equal(isAcceptableSecret(strong), true);
    assert.throws(() => assertRuntimeSecrets({ jwtSecret: '' }), /production/);
  });

  it('still refuses the published default when NODE_ENV=test', () => {
    assert.throws(
      () => assertRuntimeSecrets({ nodeEnv: 'test', jwtSecret: 'forum-credit-dev-kek-change-me' }),
      /JWT_SECRET/,
    );
  });
});
