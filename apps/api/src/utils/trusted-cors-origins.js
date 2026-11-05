/**
 * Trusted browser origins for Fastify CORS.
 * Built only from explicit env allowlists — never from Host / X-Forwarded-*.
 */

import { parseAllowedOrigins, isOriginAllowed } from './http-helpers.js';

/**
 * @param {string} raw
 * @returns {string[]}
 */
function splitCsv(raw) {
  return String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Normalize a configured origin or hostname into absolute origin strings.
 * @param {string} entry
 * @returns {string[]}
 */
export function expandTrustedOriginEntry(entry) {
  const value = String(entry || '').trim();
  if (!value) return [];
  if (value === '*') return ['*'];

  try {
    if (value.includes('://')) {
      return [new URL(value).origin.replace(/\/$/, '')];
    }
  } catch {
    return [];
  }

  // Bare hostname (possibly with port) from ALLOWED_DEV_ORIGINS / FORUM_ALLOWED_HOSTS.
  const host = value.replace(/\/+$/, '');
  if (!host || host.includes('/') || host.includes(' ')) return [];

  // Dev tunnels may be HTTPS public or HTTP LAN/Tailscale.
  return [
    `https://${host}`,
    `http://${host}`,
    // Common Next.js web port when only hostname was listed.
    ...(host.includes(':') ? [] : [`http://${host}:3100`, `https://${host}:3100`]),
  ];
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @param {{ isDev?: boolean }} [opts]
 * @returns {string}
 */
export function resolveTrustedCorsOriginConfig(env = process.env, opts = {}) {
  const isDev = opts.isDev ?? env.NODE_ENV === 'development';
  const entries = [];

  for (const part of splitCsv(env.CORS_ORIGIN)) {
    entries.push(...expandTrustedOriginEntry(part));
  }

  // Canonical public forum origin (OPS callback / tunnel HTTPS).
  entries.push(...expandTrustedOriginEntry(env.FORUM_PUBLIC_ORIGIN || ''));
  entries.push(...expandTrustedOriginEntry(env.FORUM_WEB_ORIGIN || ''));

  if (isDev) {
    for (const part of splitCsv(env.ALLOWED_DEV_ORIGINS)) {
      entries.push(...expandTrustedOriginEntry(part));
    }
    for (const part of splitCsv(env.FORUM_ALLOWED_HOSTS)) {
      entries.push(...expandTrustedOriginEntry(part));
    }
  }

  // Preserve explicit disable sentinel.
  if (String(env.CORS_ORIGIN || '').trim() === 'false' && entries.length === 0) {
    return 'false';
  }

  return [...new Set(entries.filter(Boolean))].join(',');
}

/**
 * @param {string} origin
 * @param {NodeJS.ProcessEnv} [env]
 * @param {{ isDev?: boolean }} [opts]
 */
export function isTrustedBrowserOrigin(origin, env = process.env, opts = {}) {
  if (!origin) return false;
  const config = resolveTrustedCorsOriginConfig(env, opts);
  if (!config || config === 'false') return false;
  return isOriginAllowed(origin.replace(/\/$/, ''), parseAllowedOrigins(config));
}
