/**
 * Parse hostnames allowed to use Next.js 16+ dev resources (HMR / hydration)
 * when accessing the local `next dev` server via a public tunnel or LAN IP.
 *
 * Never derives from request Host / X-Forwarded-*. Trusted config only.
 *
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {string[]} bare hostnames / patterns (no scheme, no port)
 */
export function resolveAllowedDevOrigins(env = process.env) {
  const entries = [];

  const push = (raw) => {
    const value = String(raw || '').trim();
    if (!value) return;
    for (const part of value.split(',')) {
      const item = part.trim();
      if (!item) continue;
      try {
        if (item.includes('://')) {
          entries.push(new URL(item).hostname.toLowerCase());
          continue;
        }
      } catch {
        // fall through
      }
      // Strip accidental port (Next matches hostname only).
      entries.push(item.replace(/:\d+$/, '').toLowerCase());
    }
  };

  // Explicit allow-list (preferred for tunnels / Tailscale).
  push(env.ALLOWED_DEV_ORIGINS);
  // Reuse forum host allow-list when present (same admin intent).
  push(env.FORUM_ALLOWED_HOSTS);
  // Canonical public HTTPS origin used for OPS callbacks / site URL.
  push(env.FORUM_PUBLIC_ORIGIN);

  return [...new Set(entries.filter(Boolean))];
}
