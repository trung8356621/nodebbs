import crypto from 'node:crypto';
import { FORUM_PRICING_ALG } from './constants.js';

/** Match OPS `canonicalJsonStringify` (sorted keys, no whitespace). */
export function canonicalJsonStringify(value) {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sortKeys);
  const out = {};
  for (const key of Object.keys(value).sort()) {
    out[key] = sortKeys(value[key]);
  }
  return out;
}

export function base64UrlToBuffer(value) {
  if (typeof value !== 'string' || !value) throw new Error('invalid_base64url');
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  return Buffer.from(padded + pad, 'base64');
}

export function bufferToBase64Url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function snapshotWithoutSignature(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') throw new Error('invalid_snapshot');
  const { signature, ...rest } = snapshot;
  return rest;
}

/**
 * Verify OPS forum-pricing/1 Ed25519 signature.
 * @param {object} snapshot — full snapshot including signature
 * @param {{ keyId: string, publicKeySpkiBase64Url: string }} verification
 */
export function verifyForumPricingSnapshot(snapshot, verification) {
  if (!snapshot?.signature || snapshot.signature.alg !== FORUM_PRICING_ALG) {
    return { ok: false, reason: 'invalid_signature_alg' };
  }
  if (!verification?.keyId || !verification?.publicKey) {
    return { ok: false, reason: 'missing_verification_key' };
  }
  if (snapshot.signature.keyId !== verification.keyId) {
    return { ok: false, reason: 'unknown_key_id' };
  }
  if (verification.alg && verification.alg !== FORUM_PRICING_ALG) {
    return { ok: false, reason: 'invalid_verification_alg' };
  }

  let publicKey;
  try {
    const spki = base64UrlToBuffer(verification.publicKey);
    publicKey = crypto.createPublicKey({ key: spki, format: 'der', type: 'spki' });
  } catch {
    return { ok: false, reason: 'invalid_public_key' };
  }
  if (publicKey.asymmetricKeyType !== 'ed25519') {
    return { ok: false, reason: 'public_key_not_ed25519' };
  }

  const body = snapshotWithoutSignature(snapshot);
  const bytes = Buffer.from(canonicalJsonStringify(body), 'utf8');
  let sig;
  try {
    sig = base64UrlToBuffer(snapshot.signature.value);
  } catch {
    return { ok: false, reason: 'invalid_signature_encoding' };
  }
  if (sig.length !== 64) return { ok: false, reason: 'invalid_signature_length' };

  const ok = crypto.verify(null, bytes, publicKey, sig);
  return ok ? { ok: true } : { ok: false, reason: 'signature_mismatch' };
}

/** Test helper: sign unsigned body with PKCS8 PEM or DER private key. */
export function signForumPricingBody(bodyWithoutSignature, privateKeyPemOrDer, keyId = 'fpk_v1') {
  const key = typeof privateKeyPemOrDer === 'string' && privateKeyPemOrDer.includes('BEGIN')
    ? crypto.createPrivateKey(privateKeyPemOrDer)
    : crypto.createPrivateKey({ key: privateKeyPemOrDer, format: 'der', type: 'pkcs8' });
  const bytes = Buffer.from(canonicalJsonStringify(bodyWithoutSignature), 'utf8');
  const value = bufferToBase64Url(crypto.sign(null, bytes, key));
  return {
    ...bodyWithoutSignature,
    signature: { alg: FORUM_PRICING_ALG, keyId, value },
  };
}

export function exportSpkiBase64Url(publicKey) {
  return bufferToBase64Url(publicKey.export({ type: 'spki', format: 'der' }));
}
