/**
 * OAuth redirect / callback URL helpers.
 *
 * Browser redirect_uri must match the route Google (etc.) actually hits.
 * Google/GitHub/WeChat: Next.js page at /auth/<provider>/callback
 * Apple: Fastify form_post at /api/oauth/apple/callback (same public origin via proxy)
 */
import { resolveTrustedPublicOrigin } from '../../utils/public-origin.js';

/** @type {Record<string, string>} */
export const OAUTH_CALLBACK_PATHS = {
  google: '/auth/google/callback',
  github: '/auth/github/callback',
  apple: '/api/oauth/apple/callback',
  wechat_open: '/auth/wechat_open/callback',
  wechat_mp: '/auth/wechat_mp/callback',
};

/**
 * @param {string} provider
 * @returns {string | null}
 */
export function getOAuthCallbackPath(provider) {
  return OAUTH_CALLBACK_PATHS[provider] || null;
}

/**
 * @param {unknown} raw
 * @param {string} expectedPath
 * @returns {string | null}
 */
export function normalizeStoredOAuthCallbackUrl(raw, expectedPath) {
  const input = String(raw || '').trim();
  if (!input || !expectedPath) return null;
  try {
    const url = new URL(input);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (url.pathname.replace(/\/+$/, '') !== expectedPath.replace(/\/+$/, '')) return null;
    // OAuth redirect URIs must not carry query/hash noise.
    if (url.search || url.hash) return null;
    return `${url.origin}${expectedPath}`;
  } catch {
    return null;
  }
}

/**
 * Resolve the absolute OAuth callback URL for a provider from trusted config only.
 *
 * @param {string} provider
 * @param {{ getSetting?: Function, get?: Function } | null | undefined} settings
 * @param {NodeJS.ProcessEnv} [env]
 * @param {{ storedCallbackUrl?: string | null }} [opts]
 * @returns {Promise<{
 *   callbackUrl: string | null,
 *   path: string | null,
 *   origin: string | null,
 *   originSource: string | null,
 *   resolvable: boolean,
 *   reason: string | null,
 * }>}
 */
export async function resolveOAuthCallbackUrl(provider, settings, env = process.env, opts = {}) {
  const path = getOAuthCallbackPath(provider);
  if (!path) {
    return {
      callbackUrl: null,
      path: null,
      origin: null,
      originSource: null,
      resolvable: false,
      reason: 'unsupported_provider',
    };
  }

  const originInfo = await resolveTrustedPublicOrigin(settings, env);
  if (originInfo.origin) {
    return {
      callbackUrl: `${originInfo.origin}${path}`,
      path,
      origin: originInfo.origin,
      originSource: originInfo.source,
      resolvable: true,
      reason: null,
    };
  }

  // Last resort: previously persisted callback that still matches the deployed route.
  // Never invent Host-based URLs; only reuse an explicit stored absolute URL.
  const stored = normalizeStoredOAuthCallbackUrl(opts.storedCallbackUrl, path);
  if (stored) {
    return {
      callbackUrl: stored,
      path,
      origin: new URL(stored).origin,
      originSource: 'stored_callback_url',
      resolvable: true,
      reason: null,
    };
  }

  return {
    callbackUrl: null,
    path,
    origin: null,
    originSource: null,
    resolvable: false,
    reason: originInfo.reason || 'public_origin_not_configured',
  };
}
