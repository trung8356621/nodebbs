import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  expandTrustedOriginEntry,
  isTrustedBrowserOrigin,
  resolveTrustedCorsOriginConfig,
} from './trusted-cors-origins.js';

describe('trusted-cors-origins', () => {
  it('expands URLs and hostnames without trusting forwarded headers', () => {
    assert.deepEqual(
      expandTrustedOriginEntry('https://pbn-dev.example.com/'),
      ['https://pbn-dev.example.com'],
    );
    assert.ok(expandTrustedOriginEntry('100.92.202.31').includes('http://100.92.202.31:3100'));
    assert.ok(expandTrustedOriginEntry('pbn-dev.example.com').includes('https://pbn-dev.example.com'));
  });

  it('merges CORS_ORIGIN with FORUM_PUBLIC_ORIGIN', () => {
    const cfg = resolveTrustedCorsOriginConfig({
      NODE_ENV: 'production',
      CORS_ORIGIN: 'http://localhost:3100',
      FORUM_PUBLIC_ORIGIN: 'https://pbn-dev.cholinktonghop.com',
      HTTP_HOST: 'evil.example',
      X_FORWARDED_HOST: 'evil.example',
    }, { isDev: false });
    assert.match(cfg, /http:\/\/localhost:3100/);
    assert.match(cfg, /https:\/\/pbn-dev\.cholinktonghop\.com/);
    assert.doesNotMatch(cfg, /evil\.example/);
  });

  it('in development also expands ALLOWED_DEV_ORIGINS hostnames', () => {
    const cfg = resolveTrustedCorsOriginConfig({
      NODE_ENV: 'development',
      CORS_ORIGIN: 'http://localhost:3100',
      ALLOWED_DEV_ORIGINS: 'pbn-dev.cholinktonghop.com,100.92.202.31',
    }, { isDev: true });
    assert.equal(
      isTrustedBrowserOrigin('https://pbn-dev.cholinktonghop.com', {
        NODE_ENV: 'development',
        CORS_ORIGIN: 'http://localhost:3100',
        ALLOWED_DEV_ORIGINS: 'pbn-dev.cholinktonghop.com,100.92.202.31',
      }, { isDev: true }),
      true,
    );
    assert.equal(
      isTrustedBrowserOrigin('http://100.92.202.31:3100', {
        NODE_ENV: 'development',
        CORS_ORIGIN: 'http://localhost:3100',
        ALLOWED_DEV_ORIGINS: 'pbn-dev.cholinktonghop.com,100.92.202.31',
      }, { isDev: true }),
      true,
    );
    assert.equal(
      isTrustedBrowserOrigin('https://attacker.example', {
        NODE_ENV: 'development',
        CORS_ORIGIN: 'http://localhost:3100',
        ALLOWED_DEV_ORIGINS: 'pbn-dev.cholinktonghop.com',
      }, { isDev: true }),
      false,
    );
    assert.match(cfg, /pbn-dev\.cholinktonghop\.com/);
  });

  it('does not import ALLOWED_DEV_ORIGINS in production mode', () => {
    assert.equal(
      isTrustedBrowserOrigin('https://pbn-dev.cholinktonghop.com', {
        NODE_ENV: 'production',
        CORS_ORIGIN: 'http://localhost:3100',
        ALLOWED_DEV_ORIGINS: 'pbn-dev.cholinktonghop.com',
      }, { isDev: false }),
      false,
    );
    assert.equal(
      isTrustedBrowserOrigin('https://pbn-dev.cholinktonghop.com', {
        NODE_ENV: 'production',
        CORS_ORIGIN: 'http://localhost:3100',
        FORUM_PUBLIC_ORIGIN: 'https://pbn-dev.cholinktonghop.com',
      }, { isDev: false }),
      true,
    );
  });
});
