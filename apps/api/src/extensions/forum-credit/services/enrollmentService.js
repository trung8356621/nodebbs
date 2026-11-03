import { CONNECTION_STATUS, FORUM_CREDIT_CONTRACT, OPS_DEFAULT_BASE_URL } from '../constants.js';
import { redactSecrets } from '../crypto.js';

export class EnrollmentService {
  constructor(fastify, connectionStore, opsClient) {
    this.fastify = fastify;
    this.connectionStore = connectionStore;
    this.opsClient = opsClient;
  }

  /**
   * Consume one-time enrollment key from OPS; store machine credential encrypted.
   * Never returns credential to the browser.
   */
  async enroll({ enrollmentToken, connectionUrl, opsBaseUrl, clientVersion }) {
    const token = String(enrollmentToken || '').trim();
    if (!token) {
      const err = new Error('enrollmentToken is required');
      err.code = 'invalid_enrollment_token';
      err.statusCode = 400;
      throw err;
    }

    const existing = await this.connectionStore.getRow();
    if (existing?.credentialCiphertext) {
      const err = new Error('Already enrolled. Use reconnect/rotation instead of a new enrollment key.');
      err.code = 'already_enrolled';
      err.statusCode = 409;
      throw err;
    }

    const base = (opsBaseUrl || process.env.OPS_FORUM_BASE_URL || OPS_DEFAULT_BASE_URL).replace(/\/$/, '');
    let response;
    try {
      response = await this.opsClient.consumeEnrollment({
        enrollmentToken: token,
        connectionUrl: connectionUrl || null,
        clientVersion,
        opsBaseUrl: base,
      });
    } catch (err) {
      this.fastify.log.warn(
        { err: redactSecrets({ code: err.code, message: err.message }) },
        '[forum-credit] enrollment failed',
      );
      throw err;
    }

    const data = response.data || {};
    if (!data.installationId || !data.forumId || !data.credential) {
      const err = new Error('OPS enrollment response incomplete');
      err.code = 'ops_invalid_response';
      err.statusCode = 502;
      throw err;
    }

    const row = await this.connectionStore.upsertEnrollment({
      opsBaseUrl: base,
      installationId: data.installationId,
      forumId: data.forumId,
      apiContractVersion: data.apiContractVersion || FORUM_CREDIT_CONTRACT,
      credential: data.credential,
      credentialVersion: data.credentialVersion || 1,
      connectionUrl: connectionUrl || null,
    });

    // Clear plaintext from memory reference (best-effort).
    data.credential = undefined;

    return this.connectionStore.toPublicView(row);
  }

  /** Re-verify with OPS (machine → OPS → Forum ping round-trip initiated by OPS). */
  async verify() {
    const row = await this.connectionStore.getRow();
    if (!row) {
      const err = new Error('Not enrolled');
      err.code = 'not_enrolled';
      err.statusCode = 400;
      throw err;
    }
    await this.connectionStore.setStatus({
      connectionStatus: CONNECTION_STATUS.VERIFYING,
      lastError: null,
    });
    try {
      const credential = await this.connectionStore.getActiveCredentialPlaintext();
      const { data } = await this.opsClient.verifyConnection(row, credential);
      await this.connectionStore.setStatus({
        connectionStatus: CONNECTION_STATUS.CONNECTED,
        lastVerifiedAt: new Date(),
        lastError: null,
      });
      return { ...this.connectionStore.toPublicView(await this.connectionStore.getRow()), opsView: data };
    } catch (err) {
      await this.connectionStore.setStatus({
        connectionStatus: CONNECTION_STATUS.ERROR,
        lastError: err.message,
      });
      throw err;
    }
  }

  async refreshStatus() {
    const row = await this.connectionStore.getRow();
    if (!row) return this.connectionStore.toPublicView(null);
    try {
      const credential = await this.connectionStore.getActiveCredentialPlaintext();
      const { data } = await this.opsClient.getConnection(row, credential);
      return { ...this.connectionStore.toPublicView(row), opsView: data };
    } catch (err) {
      return {
        ...this.connectionStore.toPublicView(row),
        lastError: err.message,
        opsError: err.code,
      };
    }
  }

  /**
   * Accept plaintext credential from OPS admin rotation response (server-side only path),
   * store as pending, confirm with OPS using NEW bearer, then activate.
   */
  async applyRotation({ rotationId, credential, credentialVersion }) {
    if (!rotationId || !credential) {
      const err = new Error('rotationId and credential are required');
      err.statusCode = 400;
      throw err;
    }
    await this.connectionStore.storePendingRotation({
      rotationId,
      credential,
      credentialVersion: credentialVersion || null,
    });
    const row = await this.connectionStore.getRow();
    await this.opsClient.confirmCredentialRotation(row, credential, rotationId);
    await this.connectionStore.activatePendingRotation();
    return this.connectionStore.toPublicView(await this.connectionStore.getRow());
  }
}
