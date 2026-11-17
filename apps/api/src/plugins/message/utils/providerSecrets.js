/**
 * Encrypt / redact / merge sensitive fields in message provider config JSON.
 */
import { encryptSecret, decryptSecret } from '../../../utils/secretCrypto.js';
import { isEmailAddress } from '../../../utils/normalization.js';

export const EMAIL_SECRET_KEYS = Object.freeze(['smtpPassword', 'apiKey']);
export const SMS_SECRET_KEYS = Object.freeze(['accessKeySecret', 'secretKey']);

export const SMTP_ENCRYPTION_MODES = Object.freeze(['none', 'starttls', 'ssl']);

/**
 * @param {object|null|undefined} config
 * @param {string[]} secretKeys
 * @returns {object|null}
 */
export function sanitizeConfigForClient(config, secretKeys = EMAIL_SECRET_KEYS) {
  if (!config || typeof config !== 'object') return config ?? null;

  const out = { ...config };
  for (const key of secretKeys) {
    const hasKey = `has${key.charAt(0).toUpperCase()}${key.slice(1)}`;
    out[hasKey] = Boolean(out[key]);
    delete out[key];
  }
  return out;
}

/**
 * Decrypt secret fields in-place for sending mail/SMS.
 * @param {object|null|undefined} config
 * @param {string[]} secretKeys
 * @returns {object|null}
 */
export function decryptConfigSecrets(config, secretKeys = EMAIL_SECRET_KEYS) {
  if (!config || typeof config !== 'object') return config ?? null;

  const out = { ...config };
  for (const key of secretKeys) {
    if (out[key]) {
      out[key] = decryptSecret(out[key]);
    }
  }
  return out;
}

/**
 * Merge incoming config onto existing, encrypting secrets.
 * - Empty / omitted secret → keep existing
 * - clearSecrets includes key → remove secret
 * @param {object} existingConfig
 * @param {object} incomingConfig
 * @param {{ clearSecrets?: string[], secretKeys?: string[] }} [options]
 */
export function mergeProviderConfig(existingConfig, incomingConfig, options = {}) {
  const secretKeys = options.secretKeys || EMAIL_SECRET_KEYS;
  const clearSecrets = new Set(options.clearSecrets || []);
  const existing = existingConfig && typeof existingConfig === 'object' ? { ...existingConfig } : {};
  const incoming = incomingConfig && typeof incomingConfig === 'object' ? { ...incomingConfig } : {};

  // Never accept client-side has* flags as stored values
  for (const key of secretKeys) {
    const hasKey = `has${key.charAt(0).toUpperCase()}${key.slice(1)}`;
    delete incoming[hasKey];
  }

  const merged = { ...existing, ...incoming };

  for (const key of secretKeys) {
    if (clearSecrets.has(key)) {
      delete merged[key];
      continue;
    }

    const next = incoming[key];
    if (next === undefined || next === null || next === '') {
      // Keep existing (possibly encrypted) secret
      if (existing[key]) merged[key] = existing[key];
      else delete merged[key];
      continue;
    }

    merged[key] = encryptSecret(String(next));
  }

  // Re-encrypt legacy plaintext secrets that were not updated this request
  for (const key of secretKeys) {
    if (merged[key] && !String(merged[key]).startsWith('enc:v1:')) {
      merged[key] = encryptSecret(String(merged[key]));
    }
  }

  // Normalize SMTP encryption + secure boolean for backward compatibility
  if (merged.smtpEncryption != null && merged.smtpEncryption !== '') {
    merged.smtpEncryption = String(merged.smtpEncryption).toLowerCase();
    if (SMTP_ENCRYPTION_MODES.includes(merged.smtpEncryption)) {
      merged.smtpSecure = merged.smtpEncryption === 'ssl';
    }
    // Invalid values are left for validateEmailProviderConfig to reject
  } else if (merged.smtpSecure !== undefined) {
    merged.smtpEncryption = merged.smtpSecure ? 'ssl' : 'starttls';
  }

  return merged;
}

/**
 * Validate SMTP / API email provider config fields.
 * @param {string} providerName
 * @param {object} config
 * @param {{ requireSecrets?: boolean }} [options]
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function validateEmailProviderConfig(providerName, config, options = {}) {
  const requireSecrets = options.requireSecrets !== false;
  if (!config || typeof config !== 'object') {
    return { ok: false, message: 'Configuration is required' };
  }

  if (!config.fromEmail || !isEmailAddress(config.fromEmail)) {
    return { ok: false, message: 'A valid From Email address is required' };
  }

  const isSmtp = providerName === 'smtp' || providerName === 'aliyun';
  const isApi = providerName === 'sendgrid' || providerName === 'resend';

  if (isSmtp) {
    const host = String(config.smtpHost || '').trim();
    if (!host || /\s/.test(host) || host.length > 255) {
      return { ok: false, message: 'A valid SMTP host is required' };
    }

    const port = Number(config.smtpPort);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return { ok: false, message: 'SMTP port must be an integer between 1 and 65535' };
    }

    const encryption = String(
      config.smtpEncryption || (config.smtpSecure === false ? 'starttls' : 'ssl')
    ).toLowerCase();
    if (!SMTP_ENCRYPTION_MODES.includes(encryption)) {
      return { ok: false, message: 'Encryption must be none, starttls, or ssl' };
    }

    if (!String(config.smtpUser || '').trim()) {
      return { ok: false, message: 'SMTP username is required' };
    }

    if (requireSecrets && !config.smtpPassword) {
      return { ok: false, message: 'SMTP password is required' };
    }
  }

  if (isApi && requireSecrets && !config.apiKey) {
    return { ok: false, message: 'API key is required' };
  }

  return { ok: true };
}
