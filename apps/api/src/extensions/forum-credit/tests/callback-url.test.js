import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  assertPublicHttpsCallback,
  isLoopbackHostname,
  isPrivateOrLocalHostname,
  normalizeCallbackOrigin,
  probeCallbackReachesFastify,
  resolveConfiguredPublicOrigin,
  verifyOpsCallbackUrl,
} from '../services/callbackUrl.js';

describe('callbackUrl helpers', () => {
  it('rejects localhost and private hosts as OPS callbacks', () => {
    assert.equal(isLoopbackHostname('localhost'), true);
    assert.equal(isLoopbackHostname('127.0.0.1'), true);
    assert.equal(isPrivateOrLocalHostname('192.168.1.10'), true);
    assert.equal(isPrivateOrLocalHostname('10.0.0.5'), true);
    assert.equal(isPrivateOrLocalHostname('forum.example.com'), false);

    assert.throws(
      () => assertPublicHttpsCallback('http://localhost:3100'),
      (e) => e.code === 'callback_url_https_required' || e.code === 'callback_url_localhost_forbidden',
    );
    assert.throws(
      () => assertPublicHttpsCallback('https://localhost'),
      (e) => e.code === 'callback_url_localhost_forbidden',
    );
    assert.throws(
      () => assertPublicHttpsCallback('https://127.0.0.1'),
      (e) => e.code === 'callback_url_localhost_forbidden',
    );
  });

  it('normalizes public HTTPS origins and rejects paths', () => {
    assert.equal(
      normalizeCallbackOrigin('https://forum.example.com/'),
      'https://forum.example.com',
    );
    assert.throws(
      () => normalizeCallbackOrigin('https://forum.example.com/ops/v1/forum/ping'),
      (e) => e.code === 'callback_url_invalid',
    );
    assert.equal(
      assertPublicHttpsCallback('https://forum.example.com/'),
      'https://forum.example.com',
    );
  });

  it('resolves configured public origin from env/site_url, never Host headers', async () => {
    const https = await resolveConfiguredPublicOrigin(
      { getSetting: async () => 'https://forum.example.com' },
      {},
    );
    assert.equal(https.usableAsCallback, true);
    assert.equal(https.configuredOrigin, 'https://forum.example.com');
    assert.equal(https.requiresTunnel, false);

    const local = await resolveConfiguredPublicOrigin(
      { getSetting: async () => 'http://localhost:3100' },
      {},
    );
    assert.equal(local.usableAsCallback, false);
    assert.equal(local.requiresTunnel, true);
    assert.equal(local.reason, 'insecure_http');

    const envWins = await resolveConfiguredPublicOrigin(
      { getSetting: async () => 'http://localhost:3100' },
      { FORUM_PUBLIC_ORIGIN: 'https://tunnel.example.com' },
    );
    assert.equal(envWins.usableAsCallback, true);
    assert.equal(envWins.configuredOrigin, 'https://tunnel.example.com');
    assert.equal(envWins.source, 'FORUM_PUBLIC_ORIGIN');
  });

  it('probe accepts Fastify unauthorized JSON on /ops/v1/forum/ping', async () => {
    const fetchImpl = async (url) => {
      assert.match(url, /\/ops\/v1\/forum\/ping$/);
      return {
        status: 401,
        text: async () => JSON.stringify({ error: 'unauthorized', message: 'Missing Bearer credential' }),
      };
    };
    const result = await probeCallbackReachesFastify('https://forum.example.com', { fetchImpl });
    assert.equal(result.ok, true);

    await assert.rejects(
      () => probeCallbackReachesFastify('https://forum.example.com', {
        fetchImpl: async () => ({
          status: 404,
          text: async () => '<html>not found</html>',
        }),
      }),
      (e) => e.code === 'callback_not_fastify',
    );
  });

  it('verifyOpsCallbackUrl refuses localhost even if probe would pass', async () => {
    await assert.rejects(
      () => verifyOpsCallbackUrl('https://localhost', {
        skipProbe: true,
      }),
      (e) => e.code === 'callback_url_localhost_forbidden',
    );
  });
});
