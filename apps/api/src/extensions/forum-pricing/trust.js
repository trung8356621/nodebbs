import crypto from 'node:crypto';
import fs from 'node:fs';
import { FORUM_PRICING_ALG } from './constants.js';
import { base64UrlToBuffer, bufferToBase64Url } from './crypto.js';

/**
 * Independent OPS signing-key trust registry.
 * Sync-response `verification.publicKey` is NEVER trusted by itself.
 *
 * Config (any one):
 * - FORUM_PRICING_TRUSTED_KEYS_JSON='[{"keyId":"fpk_v1","publicKey":"<spki-b64url>","status":"active"}]'
 * - FORUM_PRICING_TRUST_KEY_ID + FORUM_PRICING_TRUST_PUBLIC_KEY (SPKI base64url)
 * - FORUM_PRICING_TRUST_KEY_ID + FORUM_PRICING_TRUST_KEY_FILE (PEM/SPKI file)
 *
 * Rotation: add a new active keyId entry (or update env) out-of-band; retire old keyIds.
 * Private keys must never appear in PBN config.
 */

function fingerprintSpkiBase64Url(publicKeySpkiBase64Url) {
  const der = base64UrlToBuffer(publicKeySpkiBase64Url);
  return crypto.createHash('sha256').update(der).digest('hex');
}

function normalizeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const keyId = String(raw.keyId || '').trim();
  let publicKey = String(raw.publicKey || raw.publicKeySpkiBase64Url || '').trim();
  if (!keyId || !publicKey) return null;
  if (publicKey.includes('BEGIN PUBLIC KEY')) {
    const key = crypto.createPublicKey(publicKey);
    publicKey = bufferToBase64Url(key.export({ type: 'spki', format: 'der' }));
  }
  const status = (raw.status || 'active').toLowerCase();
  if (!['active', 'retired'].includes(status)) return null;
  const fingerprint = String(raw.fingerprint || fingerprintSpkiBase64Url(publicKey)).toLowerCase();
  return {
    keyId,
    publicKey,
    fingerprint,
    status,
    alg: FORUM_PRICING_ALG,
  };
}

function loadFromJsonEnv() {
  const raw = process.env.FORUM_PRICING_TRUSTED_KEYS_JSON?.trim();
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('FORUM_PRICING_TRUSTED_KEYS_JSON must be an array');
  return parsed.map(normalizeEntry).filter(Boolean);
}

function loadFromSingleEnv() {
  const keyId = process.env.FORUM_PRICING_TRUST_KEY_ID?.trim();
  if (!keyId) return [];
  let publicKey = process.env.FORUM_PRICING_TRUST_PUBLIC_KEY?.trim() || '';
  const file = process.env.FORUM_PRICING_TRUST_KEY_FILE?.trim();
  if (!publicKey && file) {
    publicKey = fs.readFileSync(file, 'utf8').trim();
  }
  const entry = normalizeEntry({ keyId, publicKey, status: 'active' });
  return entry ? [entry] : [];
}

let cached = null;

/** @returns {Array<{keyId:string,publicKey:string,fingerprint:string,status:string,alg:string}>} */
export function loadTrustedKeyRegistry({ forceReload = false } = {}) {
  if (cached && !forceReload) return cached;
  const entries = [...loadFromJsonEnv(), ...loadFromSingleEnv()];
  const byId = new Map();
  for (const e of entries) {
    const prev = byId.get(e.keyId);
    if (prev && prev.fingerprint !== e.fingerprint) {
      throw Object.assign(new Error(`Conflicting trust entries for keyId ${e.keyId}`), {
        code: 'trust_registry_conflict',
      });
    }
    byId.set(e.keyId, e);
  }
  cached = [...byId.values()];
  return cached;
}

export function clearTrustedKeyRegistryCache() {
  cached = null;
}

export function listActiveTrustedKeys() {
  return loadTrustedKeyRegistry().filter((e) => e.status === 'active');
}

/**
 * Resolve a trusted verification material for keyId.
 * Ignores untrusted sync-response keys.
 */
export function resolveTrustedVerification(keyId, syncVerification = null) {
  if (!keyId || typeof keyId !== 'string') {
    return { ok: false, reason: 'missing_key_id' };
  }
  const registry = loadTrustedKeyRegistry();
  if (!registry.length) {
    return { ok: false, reason: 'trust_registry_empty' };
  }
  const entry = registry.find((e) => e.keyId === keyId);
  if (!entry) {
    return { ok: false, reason: 'unknown_key_id' };
  }
  if (entry.status !== 'active') {
    return { ok: false, reason: 'key_retired' };
  }

  // If OPS also sent a publicKey, it must match the pinned trust entry (advisory integrity).
  if (syncVerification?.publicKey) {
    let incoming = String(syncVerification.publicKey).trim();
    if (incoming.includes('BEGIN PUBLIC KEY')) {
      incoming = bufferToBase64Url(
        crypto.createPublicKey(incoming).export({ type: 'spki', format: 'der' }),
      );
    }
    const incomingFp = fingerprintSpkiBase64Url(incoming);
    if (incomingFp !== entry.fingerprint) {
      return { ok: false, reason: 'untrusted_sync_public_key' };
    }
    if (syncVerification.keyId && syncVerification.keyId !== keyId) {
      return { ok: false, reason: 'key_id_mismatch' };
    }
  }

  return {
    ok: true,
    verification: {
      alg: FORUM_PRICING_ALG,
      keyId: entry.keyId,
      publicKey: entry.publicKey,
      fingerprint: entry.fingerprint,
      source: 'trusted_registry',
    },
  };
}

export function publicKeyFingerprint(publicKeySpkiBase64Url) {
  return fingerprintSpkiBase64Url(publicKeySpkiBase64Url);
}

export { fingerprintSpkiBase64Url };
