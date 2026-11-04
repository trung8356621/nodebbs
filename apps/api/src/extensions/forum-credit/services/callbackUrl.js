/**
 * OPS → PBN public callback origin helpers.
 * Never trust arbitrary Host / X-Forwarded-* for deciding the callback.
 */

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0', '[::1]']);

/** @param {string} hostname */
export function isLoopbackHostname(hostname) {
  const h = String(hostname || '').toLowerCase().replace(/\.$/, '');
  if (!h) return false;
  if (LOOPBACK_HOSTS.has(h)) return true;
  if (h.endsWith('.localhost')) return true;
  return false;
}

/** @param {string} hostname */
export function isPrivateOrLocalHostname(hostname) {
  const h = String(hostname || '').toLowerCase().replace(/\.$/, '');
  if (!h) return true;
  if (isLoopbackHostname(h)) return true;
  if (h.endsWith('.local') || h.endsWith('.internal')) return true;
  // IPv4 private / link-local
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) {
    const parts = h.split('.').map((n) => Number(n));
    if (parts.some((n) => Number.isNaN(n) || n > 255)) return true;
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 127) return true;
  }
  return false;
}

/**
 * Normalize a candidate callback to origin form (scheme://host[:port], no path).
 * @param {unknown} raw
 * @returns {string}
 */
export function normalizeCallbackOrigin(raw) {
  const input = String(raw || '').trim().replace(/\/+$/, '');
  if (!input) {
    const err = new Error('connectionUrl is required');
    err.code = 'callback_url_required';
    err.statusCode = 400;
    throw err;
  }
  let url;
  try {
    url = new URL(input);
  } catch {
    const err = new Error('connectionUrl must be a valid absolute URL');
    err.code = 'callback_url_invalid';
    err.statusCode = 400;
    throw err;
  }
  if (url.username || url.password) {
    const err = new Error('connectionUrl must not include credentials');
    err.code = 'callback_url_invalid';
    err.statusCode = 400;
    throw err;
  }
  if (url.pathname && url.pathname !== '/') {
    const err = new Error('connectionUrl must be an origin only (no path). OPS calls /ops/v1/forum/* on that origin.');
    err.code = 'callback_url_invalid';
    err.statusCode = 400;
    throw err;
  }
  if (url.search || url.hash) {
    const err = new Error('connectionUrl must not include query or hash');
    err.code = 'callback_url_invalid';
    err.statusCode = 400;
    throw err;
  }
  return url.origin;
}

/**
 * Assert URL is a public HTTPS origin OPS may call. Never allows localhost.
 * @param {unknown} raw
 * @returns {string} normalized origin
 */
export function assertPublicHttpsCallback(raw) {
  const origin = normalizeCallbackOrigin(raw);
  let url;
  try {
    url = new URL(origin);
  } catch {
    const err = new Error('connectionUrl must be a valid absolute URL');
    err.code = 'callback_url_invalid';
    err.statusCode = 400;
    throw err;
  }
  if (url.protocol !== 'https:') {
    const err = new Error('OPS callback must use HTTPS (localhost/http are not allowed)');
    err.code = 'callback_url_https_required';
    err.statusCode = 400;
    throw err;
  }
  if (isPrivateOrLocalHostname(url.hostname)) {
    const err = new Error(
      'OPS callback must be a public HTTPS origin. Localhost and private hosts are never allowed — use a public HTTPS tunnel for local development.',
    );
    err.code = 'callback_url_localhost_forbidden';
    err.statusCode = 400;
    throw err;
  }
  return origin;
}

/**
 * Resolve the forum's configured public origin from trusted sources only
 * (env + site_url setting). Never from request Host / X-Forwarded-Host.
 *
 * @param {{ getSetting?: Function }} settings
 * @param {NodeJS.ProcessEnv} [env]
 */
export async function resolveConfiguredPublicOrigin(settings, env = process.env) {
  const fromEnv = String(
    env.FORUM_PUBLIC_ORIGIN || env.OPS_FORUM_PUBLIC_ORIGIN || '',
  ).trim().replace(/\/+$/, '');
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

  const candidates = [fromEnv, fromSite].filter(Boolean);
  /** @type {null | { origin: string, source: string, usable: boolean, reason: string | null }} */
  let best = null;

  for (const raw of candidates) {
    let url;
    try {
      url = new URL(raw);
    } catch {
      continue;
    }
    const origin = url.origin;
    const source = raw === fromEnv
      ? (env.FORUM_PUBLIC_ORIGIN ? 'FORUM_PUBLIC_ORIGIN' : 'OPS_FORUM_PUBLIC_ORIGIN')
      : 'site_url';
    if (url.protocol === 'https:' && !isPrivateOrLocalHostname(url.hostname)) {
      return {
        configuredOrigin: origin,
        source,
        usableAsCallback: true,
        requiresTunnel: false,
        reason: null,
      };
    }
    if (!best) {
      const loopback = isLoopbackHostname(url.hostname) || isPrivateOrLocalHostname(url.hostname);
      best = {
        configuredOrigin: origin,
        source,
        usableAsCallback: false,
        requiresTunnel: true,
        reason: url.protocol !== 'https:'
          ? 'insecure_http'
          : loopback
            ? 'localhost_or_private'
            : 'unusable',
      };
    }
  }

  if (best) return best;

  return {
    configuredOrigin: null,
    source: null,
    usableAsCallback: false,
    requiresTunnel: true,
    reason: 'missing',
  };
}

/**
 * Probe that `${origin}/ops/v1/forum/ping` reaches the Fastify receiver.
 * Success = HTTP 401 JSON with unauthorized (route exists; auth correctly required).
 *
 * @param {string} origin
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number }} [opts]
 */
export async function probeCallbackReachesFastify(origin, opts = {}) {
  const fetchImpl = opts.fetchImpl || fetch;
  const timeoutMs = opts.timeoutMs ?? 8000;
  const url = `${origin.replace(/\/$/, '')}/ops/v1/forum/ping`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  let text = '';
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: '{}',
      signal: controller.signal,
      redirect: 'manual',
    });
    text = await res.text();
  } catch (err) {
    const e = new Error(
      `Callback probe failed: cannot reach ${url} (${err.name === 'AbortError' ? 'timeout' : err.message})`,
    );
    e.code = 'callback_unreachable';
    e.statusCode = 400;
    throw e;
  } finally {
    clearTimeout(timer);
  }

  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  const looksLikeReceiver =
    res.status === 401
    && data
    && (data.error === 'unauthorized' || data.error === 'missing_credential' || typeof data.error === 'string');

  if (!looksLikeReceiver) {
    const e = new Error(
      `Callback probe did not reach Fastify /ops/v1/forum/ping (HTTP ${res.status}). `
      + 'Ensure the public origin proxies /ops to the API (not only /api).',
    );
    e.code = 'callback_not_fastify';
    e.statusCode = 400;
    e.probeStatus = res.status;
    e.probeBody = data || text.slice(0, 120);
    throw e;
  }

  return { ok: true, status: res.status, path: '/ops/v1/forum/ping' };
}

/**
 * Validate + probe a callback URL for enrollment or migration update.
 * @returns {Promise<string>} normalized verified origin
 */
export async function verifyOpsCallbackUrl(raw, opts = {}) {
  const origin = assertPublicHttpsCallback(raw);
  if (opts.skipProbe) return origin;
  await probeCallbackReachesFastify(origin, opts);
  return origin;
}
