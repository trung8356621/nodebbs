import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const KEY_ID_BYTES = 12;
const SECRET_BYTES = 32;

/** @param {string} value */
export function hashSecret(value) {
  return createHash('sha256').update(String(value), 'utf8').digest('hex');
}

/** Constant-time compare of equal-length utf8 strings. */
export function constantTimeEqual(a, b) {
  const ba = Buffer.from(String(a ?? ''), 'utf8');
  const bb = Buffer.from(String(b ?? ''), 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * Generate a one-time plaintext ingest token.
 * Format: pbn_ingest_<keyId>.<secret>
 * Dot separator avoids ambiguity with base64url underscores.
 */
export function generateIngestToken() {
  const keyId = randomBytes(KEY_ID_BYTES).toString('base64url');
  const secret = randomBytes(SECRET_BYTES).toString('base64url');
  const token = `pbn_ingest_${keyId}.${secret}`;
  return {
    keyId,
    token,
    secretHash: hashSecret(token),
  };
}

/**
 * Parse Bearer credential into keyId + full token for hash verify.
 * @param {string|null|undefined} authorization
 * @returns {{ keyId: string, token: string } | null}
 */
export function parseIngestBearer(authorization) {
  const header = String(authorization || '').trim();
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (!match) return null;
  const token = match[1];
  const parts = /^pbn_ingest_([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(token);
  if (!parts) return null;
  return { keyId: parts[1], token };
}

/**
 * Stable payload hash for idempotency (order-insensitive tags).
 * @param {{ title: string, categoryId: number, content: string, tags?: string[] }} body
 */
export function hashIngestPayload(body) {
  const tags = Array.isArray(body.tags)
    ? [...body.tags].map((t) => String(t)).sort()
    : [];
  const normalized = JSON.stringify({
    title: String(body.title ?? ''),
    categoryId: Number(body.categoryId),
    content: String(body.content ?? ''),
    tags,
  });
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}

/**
 * Validate configured public site origin for canonical URLs.
 * Accepts absolute http(s) origin only (no path/query/hash).
 * @param {string} raw
 * @returns {string} origin without trailing slash
 */
export function resolvePublicSiteOrigin(raw) {
  const value = String(raw || '').trim();
  if (!value) {
    const err = new Error('Public site origin is not configured');
    err.statusCode = 503;
    err.code = 'SITE_ORIGIN_UNCONFIGURED';
    throw err;
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    const err = new Error('Public site origin is invalid');
    err.statusCode = 503;
    err.code = 'SITE_ORIGIN_INVALID';
    throw err;
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    const err = new Error('Public site origin must be http(s)');
    err.statusCode = 503;
    err.code = 'SITE_ORIGIN_INVALID';
    throw err;
  }
  if (url.username || url.password) {
    const err = new Error('Public site origin must not include credentials');
    err.statusCode = 503;
    err.code = 'SITE_ORIGIN_INVALID';
    throw err;
  }
  if (url.pathname !== '/' && url.pathname !== '') {
    const err = new Error('Public site origin must not include a path');
    err.statusCode = 503;
    err.code = 'SITE_ORIGIN_INVALID';
    throw err;
  }
  if (url.search || url.hash) {
    const err = new Error('Public site origin must not include query or hash');
    err.statusCode = 503;
    err.code = 'SITE_ORIGIN_INVALID';
    throw err;
  }
  return url.origin;
}

/** @param {string} origin @param {number|string} topicId */
export function buildTopicCanonicalUrl(origin, topicId) {
  return `${origin.replace(/\/$/, '')}/topic/${topicId}`;
}

/**
 * Reject obvious HTML documents; ingest accepts Markdown only.
 * @param {string} content
 */
export function assertMarkdownContent(content) {
  const text = String(content || '');
  if (!text.trim()) {
    const err = new Error('Content is required');
    err.statusCode = 400;
    err.code = 'MARKDOWN_REQUIRED';
    err.body = { error: 'Markdown content is required', code: 'MARKDOWN_REQUIRED' };
    throw err;
  }
  if (/^\s*<(!DOCTYPE|html|body|head)\b/i.test(text) || /<\/(html|body)>/i.test(text)) {
    const err = new Error('HTML documents are not accepted');
    err.statusCode = 400;
    err.code = 'MARKDOWN_REQUIRED';
    err.body = {
      error: 'Content must be Markdown, not an HTML document',
      code: 'MARKDOWN_REQUIRED',
    };
    throw err;
  }
}
