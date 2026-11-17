/**
 * Resolve the forum's configured public origin from trusted sources only
 * (env + site_url setting + first absolute CORS_ORIGIN entry).
 * Never from request Host / X-Forwarded-Host.
 *
 * Preference:
 * FORUM_PUBLIC_ORIGIN → FORUM_WEB_ORIGIN → site_url → first absolute CORS_ORIGIN.
 * Does not invent localhost or any domain — only returns what is configured.
 */

/**
 * @param {unknown} raw
 * @returns {string | null}
 */
function toAbsoluteOrigin(raw) {
  const input = String(raw || '').trim().replace(/\/+$/, '');
  if (!input) return null;
  try {
    const url = new URL(input);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname) return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * @param {string | undefined} corsOrigin
 * @returns {string | null}
 */
function firstAbsoluteCorsOrigin(corsOrigin) {
  for (const part of String(corsOrigin || '').split(',')) {
    const origin = toAbsoluteOrigin(part);
    if (origin) return origin;
  }
  return null;
}

/**
 * @param {{ getSetting?: Function, get?: Function } | null | undefined} settings
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {Promise<{
 *   origin: string | null,
 *   source: string | null,
 *   reason: string | null,
 * }>}
 */
export async function resolveTrustedPublicOrigin(settings, env = process.env) {
  const fromPublic = String(env.FORUM_PUBLIC_ORIGIN || '').trim().replace(/\/+$/, '');
  const fromWeb = String(env.FORUM_WEB_ORIGIN || '').trim().replace(/\/+$/, '');

  let fromSite = '';
  const readSetting = settings?.getSetting || settings?.get;
  if (typeof readSetting === 'function') {
    try {
      const v = await readSetting.call(settings, 'site_url', '');
      fromSite = String(v || '').trim().replace(/\/+$/, '');
    } catch {
      fromSite = '';
    }
  }

  const fromCors = firstAbsoluteCorsOrigin(env.CORS_ORIGIN);

  const candidates = [
    { raw: fromPublic, source: 'FORUM_PUBLIC_ORIGIN' },
    { raw: fromWeb, source: 'FORUM_WEB_ORIGIN' },
    { raw: fromSite, source: 'site_url' },
    { raw: fromCors, source: 'CORS_ORIGIN' },
  ].filter((c) => c.raw);

  for (const { raw, source } of candidates) {
    const origin = toAbsoluteOrigin(raw);
    if (!origin) continue;
    return {
      origin,
      source,
      reason: null,
    };
  }

  return {
    origin: null,
    source: null,
    reason: 'public_origin_not_configured',
  };
}
