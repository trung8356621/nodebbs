import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { trustProxyFromEnv, trustedProtocol } from './trusted-proxy.js';

async function who(env) {
  const trust = trustProxyFromEnv(env);
  const app = Fastify({ trustProxy: trust, logger: false });
  app.get('/who', async (request) => ({
    ip: request.ip,
    cookieProtocol: trustedProtocol(request, trust),
  }));
  await app.ready();
  return app;
}

describe('trusted proxy', () => {
  it('refuses unconditional trust', () => {
    for (const value of ['true', '*', '0.0.0.0/0', '::/0']) {
      assert.throws(() => trustProxyFromEnv({ TRUSTED_PROXIES: value }), /Refusing/);
    }
  });

  it('ignores forwarded headers from an untrusted client', async () => {
    const app = await who({ TRUSTED_PROXIES: '127.0.0.1,::1' });
    const response = await app.inject({
      method: 'GET',
      url: '/who',
      remoteAddress: '203.0.113.9',
      headers: {
        'x-forwarded-for': '198.51.100.4',
        'x-forwarded-proto': 'https',
      },
    });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { ip: '203.0.113.9', cookieProtocol: 'http' });
    await app.close();
  });

  it('uses the client address and https when the peer is a trusted proxy', async () => {
    const app = await who({ TRUSTED_PROXIES: '127.0.0.1,::1' });
    const response = await app.inject({
      method: 'GET',
      url: '/who',
      remoteAddress: '127.0.0.1',
      headers: {
        'x-forwarded-for': '198.51.100.4',
        'x-forwarded-proto': 'https',
      },
    });
    assert.deepEqual(response.json(), { ip: '198.51.100.4', cookieProtocol: 'https' });
    await app.close();
  });

  it('does not let a left-hand spoof override the hop added by the proxy', async () => {
    const app = await who({ TRUSTED_PROXIES: '10.0.0.0/8' });
    const response = await app.inject({
      method: 'GET',
      url: '/who',
      remoteAddress: '10.0.0.8',
      headers: {
        'x-forwarded-for': '198.51.100.8, 203.0.113.50',
      },
    });
    assert.equal(response.json().ip, '203.0.113.50');
    await app.close();
  });

  it('trusts an IPv4-mapped loopback peer', async () => {
    const app = await who({});
    const response = await app.inject({
      method: 'GET',
      url: '/who',
      remoteAddress: '::ffff:127.0.0.1',
      headers: { 'x-forwarded-for': '203.0.113.20' },
    });
    assert.equal(response.json().ip, '203.0.113.20');
    await app.close();
  });
});
