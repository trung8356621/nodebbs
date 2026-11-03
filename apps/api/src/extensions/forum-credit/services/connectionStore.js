import { eq, desc } from 'drizzle-orm';
import db from '../../../db/index.js';
import { opsForumConnections } from '../schema.js';
import {
  encryptSecret,
  decryptSecret,
  fingerprintSecret,
  constantTimeEqual,
} from '../crypto.js';
import { CONNECTION_STATUS, FORUM_CREDIT_CONTRACT, OPS_DEFAULT_BASE_URL } from '../constants.js';

/**
 * Persist / load the single OPS Forum connection for this installation.
 * Credential plaintext never leaves the server process except outbound OPS calls.
 */
export class ConnectionStore {
  constructor(fastify) {
    this.fastify = fastify;
  }

  async getRow(tx = db) {
    const [row] = await tx.select().from(opsForumConnections).orderBy(desc(opsForumConnections.id)).limit(1);
    return row || null;
  }

  /** Public admin view — no credential material. */
  toPublicView(row) {
    if (!row) {
      return {
        connected: false,
        connectionStatus: CONNECTION_STATUS.DISCONNECTED,
        opsBaseUrl: process.env.OPS_FORUM_BASE_URL || OPS_DEFAULT_BASE_URL,
        installationId: null,
        forumId: null,
        apiContractVersion: FORUM_CREDIT_CONTRACT,
        credentialVersion: null,
        connectionUrl: null,
        lastVerifiedAt: null,
        lastSyncAt: null,
        lastError: null,
        hasCredential: false,
        pendingRotationId: null,
        enabled: false,
      };
    }
    return {
      connected: row.connectionStatus === CONNECTION_STATUS.CONNECTED,
      connectionStatus: row.connectionStatus,
      opsBaseUrl: row.opsBaseUrl,
      installationId: row.installationId,
      forumId: row.forumId,
      apiContractVersion: row.apiContractVersion,
      credentialVersion: row.credentialVersion,
      connectionUrl: row.connectionUrl,
      lastVerifiedAt: row.lastVerifiedAt,
      lastSyncAt: row.lastSyncAt,
      lastError: row.lastError,
      hasCredential: Boolean(row.credentialCiphertext),
      pendingRotationId: row.pendingRotationId,
      enabled: row.enabled,
    };
  }

  async getPublicStatus() {
    return this.toPublicView(await this.getRow());
  }

  async getActiveCredentialPlaintext(tx = db) {
    const row = await this.getRow(tx);
    if (!row?.credentialCiphertext) {
      const err = new Error('No active Forum credential');
      err.code = 'missing_credential';
      err.statusCode = 401;
      throw err;
    }
    return decryptSecret(row.credentialCiphertext, row.credentialKekVersion);
  }

  /**
   * Authenticate inbound OPS Bearer against stored credential.
   * Also enforces forumId / installationId headers match local row.
   */
  async authenticateInbound({ bearer, forumId, installationId }) {
    const row = await this.getRow();
    if (!row || !row.enabled) {
      const err = new Error('Forum OPS connection not configured');
      err.code = 'unauthorized';
      err.statusCode = 401;
      throw err;
    }
    if (!bearer) {
      const err = new Error('Missing Bearer credential');
      err.code = 'unauthorized';
      err.statusCode = 401;
      throw err;
    }
    if (installationId && installationId !== row.installationId) {
      const err = new Error('Installation ID mismatch');
      err.code = 'cross_forum_denied';
      err.statusCode = 403;
      throw err;
    }
    if (forumId && forumId !== row.forumId) {
      const err = new Error('Forum ID mismatch');
      err.code = 'cross_forum_denied';
      err.statusCode = 403;
      throw err;
    }

    const fp = fingerprintSecret(bearer);
    const activeOk = constantTimeEqual(fp, row.credentialFingerprint);
    let pendingOk = false;
    if (!activeOk && row.pendingCredentialFingerprint) {
      pendingOk = constantTimeEqual(fp, row.pendingCredentialFingerprint);
    }
    if (!activeOk && !pendingOk) {
      const err = new Error('Invalid Forum credential');
      err.code = 'unauthorized';
      err.statusCode = 401;
      throw err;
    }

    // Decrypt + compare plaintext (active or pending during rotation).
    const plaintext = activeOk
      ? decryptSecret(row.credentialCiphertext, row.credentialKekVersion)
      : decryptSecret(row.pendingCredentialCiphertext, row.credentialKekVersion);
    if (!constantTimeEqual(plaintext, bearer)) {
      const err = new Error('Invalid Forum credential');
      err.code = 'unauthorized';
      err.statusCode = 401;
      throw err;
    }

    return row;
  }

  async upsertEnrollment({
    opsBaseUrl,
    installationId,
    forumId,
    apiContractVersion,
    credential,
    credentialVersion,
    connectionUrl,
  }) {
    const enc = encryptSecret(credential);
    const fp = fingerprintSecret(credential);
    const now = new Date();
    const existing = await this.getRow();

    const values = {
      opsBaseUrl: (opsBaseUrl || OPS_DEFAULT_BASE_URL).replace(/\/$/, ''),
      installationId,
      forumId,
      apiContractVersion: apiContractVersion || FORUM_CREDIT_CONTRACT,
      credentialVersion: credentialVersion || 1,
      credentialCiphertext: enc.ciphertext,
      credentialKekVersion: enc.kekVersion,
      credentialFingerprint: fp,
      connectionStatus: CONNECTION_STATUS.DISCONNECTED,
      connectionUrl: connectionUrl || null,
      pendingRotationId: null,
      pendingCredentialCiphertext: null,
      pendingCredentialFingerprint: null,
      pendingCredentialVersion: null,
      lastError: null,
      enabled: true,
      updatedAt: now,
    };

    if (existing) {
      const [row] = await db.update(opsForumConnections)
        .set(values)
        .where(eq(opsForumConnections.id, existing.id))
        .returning();
      return row;
    }
    const [row] = await db.insert(opsForumConnections).values(values).returning();
    return row;
  }

  async setStatus({ connectionStatus, lastError, lastVerifiedAt, lastSyncAt }) {
    const existing = await this.getRow();
    if (!existing) return null;
    const patch = { updatedAt: new Date() };
    if (connectionStatus != null) patch.connectionStatus = connectionStatus;
    if (lastError !== undefined) patch.lastError = lastError;
    if (lastVerifiedAt !== undefined) patch.lastVerifiedAt = lastVerifiedAt;
    if (lastSyncAt !== undefined) patch.lastSyncAt = lastSyncAt;
    const [row] = await db.update(opsForumConnections)
      .set(patch)
      .where(eq(opsForumConnections.id, existing.id))
      .returning();
    return row;
  }

  async storePendingRotation({ rotationId, credential, credentialVersion }) {
    const existing = await this.getRow();
    if (!existing) {
      const err = new Error('No connection to rotate');
      err.statusCode = 400;
      throw err;
    }
    const enc = encryptSecret(credential);
    const fp = fingerprintSecret(credential);
    const [row] = await db.update(opsForumConnections)
      .set({
        pendingRotationId: rotationId,
        pendingCredentialCiphertext: enc.ciphertext,
        pendingCredentialFingerprint: fp,
        pendingCredentialVersion: credentialVersion,
        updatedAt: new Date(),
        lastError: null,
      })
      .where(eq(opsForumConnections.id, existing.id))
      .returning();
    return row;
  }

  /** Promote pending credential after OPS confirm. */
  async activatePendingRotation() {
    const existing = await this.getRow();
    if (!existing?.pendingRotationId || !existing.pendingCredentialCiphertext) {
      const err = new Error('No pending rotation');
      err.code = 'rotation_not_prepared';
      err.statusCode = 400;
      throw err;
    }
    const [row] = await db.update(opsForumConnections)
      .set({
        credentialCiphertext: existing.pendingCredentialCiphertext,
        credentialFingerprint: existing.pendingCredentialFingerprint,
        credentialVersion: existing.pendingCredentialVersion,
        pendingRotationId: null,
        pendingCredentialCiphertext: null,
        pendingCredentialFingerprint: null,
        pendingCredentialVersion: null,
        updatedAt: new Date(),
        lastError: null,
      })
      .where(eq(opsForumConnections.id, existing.id))
      .returning();
    return row;
  }

  async updateConnectionUrl(connectionUrl) {
    const existing = await this.getRow();
    if (!existing) return null;
    const [row] = await db.update(opsForumConnections)
      .set({ connectionUrl, updatedAt: new Date() })
      .where(eq(opsForumConnections.id, existing.id))
      .returning();
    return row;
  }
}
