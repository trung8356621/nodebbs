import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;

/**
 * Derive a stable 32-byte KEK from env.
 * Prefer OPS_FORUM_KEK (base64 or hex); fallback scrypt(JWT_SECRET).
 */
export function resolveKekMaterial() {
  const raw = process.env.OPS_FORUM_KEK || process.env.JWT_SECRET;
  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Refusing to derive a forum-credit key without OPS_FORUM_KEK or JWT_SECRET');
    }
    // Unit tests import this module without a forum env file.
  }
  const material = raw || 'forum-credit-dev-kek-change-me';
  if (/^[0-9a-fA-F]{64}$/.test(material)) {
    return { key: Buffer.from(material, 'hex'), version: process.env.OPS_FORUM_KEK_VERSION || 'v1' };
  }
  if (/^[A-Za-z0-9+/=_-]{43,}$/.test(material) && Buffer.from(material, 'base64').length === KEY_LEN) {
    return { key: Buffer.from(material, 'base64'), version: process.env.OPS_FORUM_KEK_VERSION || 'v1' };
  }
  const salt = Buffer.from('pbn-forum-credit-kek-v1');
  return {
    key: scryptSync(material, salt, KEY_LEN),
    version: process.env.OPS_FORUM_KEK_VERSION || 'v1-scrypt',
  };
}

/** @param {string} plaintext */
export function encryptSecret(plaintext) {
  const { key, version } = resolveKekMaterial();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const packed = [
    iv.toString('base64url'),
    tag.toString('base64url'),
    enc.toString('base64url'),
  ].join('.');
  return { ciphertext: packed, kekVersion: version };
}

/** @param {string} packed @param {string} [_kekVersion] */
export function decryptSecret(packed, _kekVersion) {
  const { key } = resolveKekMaterial();
  const parts = String(packed || '').split('.');
  if (parts.length !== 3) throw new Error('Invalid credential ciphertext');
  const [ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, 'base64url');
  const tag = Buffer.from(tagB64, 'base64url');
  const data = Buffer.from(dataB64, 'base64url');
  if (iv.length !== IV_LEN || tag.length !== TAG_LEN) throw new Error('Invalid credential ciphertext');
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

/** @param {string} plaintext */
export function fingerprintSecret(plaintext) {
  return createHash('sha256').update(String(plaintext), 'utf8').digest('hex');
}

/** Constant-time compare of equal-length hex/utf8 strings. */
export function constantTimeEqual(a, b) {
  const ba = Buffer.from(String(a ?? ''), 'utf8');
  const bb = Buffer.from(String(b ?? ''), 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function bearerFromHeader(authorization) {
  const header = authorization ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() || null;
}

/** Redact secrets from objects before logging. */
export function redactSecrets(value) {
  if (value == null) return value;
  if (typeof value === 'string') {
    if (value.length > 12 && /^(fenr_|fcred_|[A-Za-z0-9_-]{20,})$/.test(value)) {
      return `${value.slice(0, 4)}…[redacted]`;
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (/credential|secret|token|password|authorization/i.test(k)) {
        out[k] = '[redacted]';
      } else {
        out[k] = redactSecrets(v);
      }
    }
    return out;
  }
  return value;
}
