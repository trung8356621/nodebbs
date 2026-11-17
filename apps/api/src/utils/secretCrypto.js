/**
 * AES-256-GCM helpers for operational secrets (SMTP password, API keys, etc.).
 * Independent of forum-credit / OPS crypto — uses JWT_SECRET (or ENCRYPTION_KEY).
 *
 * Wire format: enc:v1:<iv>.<tag>.<ciphertext> (base64url parts)
 * Legacy plaintext values are returned unchanged by decryptSecret().
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;
const PREFIX = 'enc:v1:';

function resolveKey() {
  const raw = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ENCRYPTION_KEY or JWT_SECRET is required to encrypt secrets');
    }
    return scryptSync('nodebbs-dev-secret-crypto-change-me', 'pbn-secret-crypto-v1', KEY_LEN);
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  try {
    const b64 = Buffer.from(raw, 'base64');
    if (b64.length === KEY_LEN) return b64;
  } catch {
    // fall through to scrypt
  }
  return scryptSync(raw, 'pbn-secret-crypto-v1', KEY_LEN);
}

/**
 * @param {string} plaintext
 * @returns {string}
 */
export function encryptSecret(plaintext) {
  if (plaintext == null || plaintext === '') return plaintext;
  if (isEncryptedSecret(plaintext)) return plaintext;

  const key = resolveKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const packed = [
    iv.toString('base64url'),
    tag.toString('base64url'),
    enc.toString('base64url'),
  ].join('.');
  return `${PREFIX}${packed}`;
}

/**
 * @param {string} value
 * @returns {string}
 */
export function decryptSecret(value) {
  if (value == null || value === '') return value;
  if (!isEncryptedSecret(value)) return value;

  const packed = String(value).slice(PREFIX.length);
  const parts = packed.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted secret format');
  }
  const [ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, 'base64url');
  const tag = Buffer.from(tagB64, 'base64url');
  const data = Buffer.from(dataB64, 'base64url');
  if (iv.length !== IV_LEN || tag.length !== TAG_LEN) {
    throw new Error('Invalid encrypted secret format');
  }
  const decipher = createDecipheriv(ALGO, resolveKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isEncryptedSecret(value) {
  return typeof value === 'string' && value.startsWith(PREFIX);
}
