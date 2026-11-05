import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveAllowedDevOrigins } from './allowed-dev-origins.js';

describe('resolveAllowedDevOrigins', () => {
  it('parses bare hosts, URLs, and strips ports without trusting forwarded headers', () => {
    const hosts = resolveAllowedDevOrigins({
      ALLOWED_DEV_ORIGINS: 'pbn-dev.example.com,100.92.202.31:3100',
      FORUM_PUBLIC_ORIGIN: 'https://forum.example.com/',
      FORUM_ALLOWED_HOSTS: 'forum.example.com,other.example.com',
    });
    assert.deepEqual(hosts.sort(), [
      '100.92.202.31',
      'forum.example.com',
      'other.example.com',
      'pbn-dev.example.com',
    ].sort());
  });

  it('returns empty when unset (localhost-only default)', () => {
    assert.deepEqual(resolveAllowedDevOrigins({}), []);
  });

  it('never invents hosts from request-like env noise', () => {
    assert.deepEqual(
      resolveAllowedDevOrigins({
        HTTP_HOST: 'evil.example',
        X_FORWARDED_HOST: 'evil.example',
      }),
      [],
    );
  });
});
