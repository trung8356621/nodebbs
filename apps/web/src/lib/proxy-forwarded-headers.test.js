import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  edgeMayKeepForwardedHeaders,
  headersForApiProxy,
  sanitizeEdgeHeaders,
} from './proxy-forwarded-headers.js';

describe('proxy forwarded headers', () => {
  it('drops a client-supplied left hop before calling the API', () => {
    const headers = headersForApiProxy(new Headers({
      'x-forwarded-for': '198.51.100.8, 203.0.113.50',
      'x-real-ip': '198.51.100.8',
      'x-forwarded-proto': 'https, http',
    }));
    assert.equal(headers.get('x-forwarded-for'), '203.0.113.50');
    assert.equal(headers.get('x-real-ip'), null);
    assert.equal(headers.get('x-forwarded-proto'), 'https');
  });

  it('strips forwarding headers from a peer that is not a configured edge', () => {
    const headers = {
      'x-forwarded-for': '198.51.100.8',
      'x-real-ip': '198.51.100.8',
      'x-forwarded-proto': 'https',
    };
    sanitizeEdgeHeaders(headers, { peerAddress: '127.0.0.1', trustedEdges: '', socketEncrypted: false });
    assert.equal(headers['x-forwarded-for'], undefined);
    assert.equal(headers['x-real-ip'], undefined);
    assert.equal(headers['x-forwarded-proto'], undefined);
    assert.equal(edgeMayKeepForwardedHeaders('::ffff:127.0.0.1', '127.0.0.1'), true);
  });

  it('keeps nginx headers when the connecting edge is listed', () => {
    const headers = {
      'x-forwarded-for': '203.0.113.50',
      'x-forwarded-proto': 'https',
    };
    sanitizeEdgeHeaders(headers, {
      peerAddress: '127.0.0.1',
      trustedEdges: '127.0.0.1,::1',
      socketEncrypted: false,
    });
    assert.equal(headers['x-forwarded-for'], '203.0.113.50');
    assert.equal(headers['x-forwarded-proto'], 'https');
  });
});
