import {
  FORUM_CREDIT_CONTRACT,
  FORUM_PRODUCT_CODE,
  HEADER_API_CONTRACT,
  HEADER_FORUM_ID,
  HEADER_INSTALLATION_ID,
  HEADER_PRODUCT,
  OPS_DEFAULT_BASE_URL,
} from '../constants.js';
import { redactSecrets } from '../crypto.js';

/**
 * Outbound HTTPS client for OPS-SERVER forum-credit/1 APIs.
 */
export class OpsClient {
  constructor(fastify, connectionStore) {
    this.fastify = fastify;
    this.connectionStore = connectionStore;
  }

  baseUrl(override) {
    return (override || process.env.OPS_FORUM_BASE_URL || OPS_DEFAULT_BASE_URL).replace(/\/$/, '');
  }

  buildHeaders({ credential, forumId, installationId, eventId, apiContract }) {
    const headers = {
      'content-type': 'application/json',
      accept: 'application/json',
      [HEADER_PRODUCT]: FORUM_PRODUCT_CODE,
      [HEADER_API_CONTRACT]: apiContract || FORUM_CREDIT_CONTRACT,
    };
    if (credential) headers.authorization = `Bearer ${credential}`;
    if (forumId) headers[HEADER_FORUM_ID] = forumId;
    if (installationId) headers[HEADER_INSTALLATION_ID] = installationId;
    if (eventId) headers['x-ops-event-id'] = eventId;
    return headers;
  }

  async request(method, path, { baseUrl, body, credential, forumId, installationId, eventId, apiContract } = {}) {
    const url = `${this.baseUrl(baseUrl)}${path}`;
    const headers = this.buildHeaders({ credential, forumId, installationId, eventId, apiContract });
    let res;
    try {
      res = await fetch(url, {
        method,
        headers,
        body: body == null ? undefined : JSON.stringify(body),
      });
    } catch (err) {
      const e = new Error(`OPS unreachable: ${err.message}`);
      e.code = 'ops_unreachable';
      e.statusCode = 502;
      this.fastify.log.warn({ err: redactSecrets({ message: err.message, path }) }, '[forum-credit] OPS request failed');
      throw e;
    }

    let data = null;
    const text = await res.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text.slice(0, 200) };
      }
    }

    if (!res.ok) {
      const e = new Error(data?.message || data?.error || `OPS HTTP ${res.status}`);
      e.code = data?.error || 'ops_http_error';
      e.statusCode = res.status >= 400 && res.status < 600 ? res.status : 502;
      e.opsBody = data;
      this.fastify.log.warn(
        { status: res.status, path, error: data?.error },
        '[forum-credit] OPS error response',
      );
      throw e;
    }
    return { status: res.status, data };
  }

  async consumeEnrollment({ enrollmentToken, connectionUrl, clientVersion, opsBaseUrl }) {
    return this.request('POST', '/api/v1/forum/enrollments/consume', {
      baseUrl: opsBaseUrl,
      body: {
        enrollmentToken,
        connectionUrl: connectionUrl || null,
        clientVersion: clientVersion || process.env.npm_package_version || '1.0.0',
      },
    });
  }

  async getConnection(row, credential) {
    return this.request(
      'GET',
      `/api/v1/forum/installations/${encodeURIComponent(row.installationId)}/connection`,
      {
        baseUrl: row.opsBaseUrl,
        credential,
        forumId: row.forumId,
        installationId: row.installationId,
      },
    );
  }

  async verifyConnection(row, credential) {
    return this.request(
      'POST',
      `/api/v1/forum/installations/${encodeURIComponent(row.installationId)}/connection`,
      {
        baseUrl: row.opsBaseUrl,
        credential,
        forumId: row.forumId,
        installationId: row.installationId,
        body: {},
      },
    );
  }

  async createCreditOrder(row, credential, order) {
    return this.request(
      'POST',
      `/api/v1/forum/installations/${encodeURIComponent(row.installationId)}/credit/orders`,
      {
        baseUrl: row.opsBaseUrl,
        credential,
        forumId: row.forumId,
        installationId: row.installationId,
        body: order,
      },
    );
  }

  async ingestLedgerEvents(row, credential, events) {
    return this.request(
      'POST',
      `/api/v1/forum/installations/${encodeURIComponent(row.installationId)}/credit/ledger/events`,
      {
        baseUrl: row.opsBaseUrl,
        credential,
        forumId: row.forumId,
        installationId: row.installationId,
        body: { events },
      },
    );
  }

  async confirmCredentialRotation(row, credential, rotationId) {
    return this.request(
      'POST',
      `/api/v1/forum/installations/${encodeURIComponent(row.installationId)}/credentials/rotate/confirm`,
      {
        baseUrl: row.opsBaseUrl,
        credential,
        forumId: row.forumId,
        installationId: row.installationId,
        body: { rotationId },
      },
    );
  }

  async ackDelivery(row, credential, eventId) {
    return this.request(
      'POST',
      `/api/v1/forum/credit/deliveries/${encodeURIComponent(eventId)}/ack`,
      {
        baseUrl: row.opsBaseUrl,
        credential,
        forumId: row.forumId,
        installationId: row.installationId,
        body: { installationId: row.installationId, ack: true },
      },
    );
  }

  /** forum-pricing/1 machine APIs */
  async pricingSync(row, credential, { afterVersion = 0 } = {}) {
    const q = new URLSearchParams({ afterVersion: String(afterVersion) });
    return this.request(
      'GET',
      `/api/v1/forum/installations/${encodeURIComponent(row.installationId)}/pricing/sync?${q}`,
      {
        baseUrl: row.opsBaseUrl,
        credential,
        forumId: row.forumId,
        installationId: row.installationId,
        apiContract: 'forum-pricing/1',
      },
    );
  }

  async pricingCatalog(row, credential) {
    return this.request(
      'GET',
      `/api/v1/forum/installations/${encodeURIComponent(row.installationId)}/pricing/catalog`,
      {
        baseUrl: row.opsBaseUrl,
        credential,
        forumId: row.forumId,
        installationId: row.installationId,
        apiContract: 'forum-pricing/1',
      },
    );
  }

  async pricingVersion(row, credential, version) {
    return this.request(
      'GET',
      `/api/v1/forum/installations/${encodeURIComponent(row.installationId)}/pricing/versions/${encodeURIComponent(version)}`,
      {
        baseUrl: row.opsBaseUrl,
        credential,
        forumId: row.forumId,
        installationId: row.installationId,
        apiContract: 'forum-pricing/1',
      },
    );
  }

  async pricingCreateQuote(row, credential, body) {
    return this.request(
      'POST',
      `/api/v1/forum/installations/${encodeURIComponent(row.installationId)}/pricing/quotes`,
      {
        baseUrl: row.opsBaseUrl,
        credential,
        forumId: row.forumId,
        installationId: row.installationId,
        apiContract: 'forum-pricing/1',
        body,
      },
    );
  }
}
