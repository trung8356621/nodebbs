/**
 * Resolve the HttpOnly auth cookie name used by the API.
 *
 * Production forums set AUTH_COOKIE_NAME=pbn_<FORUM_ID>_auth on the API.
 * The web process must use the same name for SSR cookie → /auth/me forwarding.
 * When web env omits AUTH_COOKIE_NAME (common Docker misconfig), fall back to
 * discovering a host-scoped forum auth cookie already present on the request.
 */

const FORUM_AUTH_COOKIE_RE = /^pbn_[a-z][a-z0-9_]*_auth$/;

export function getAuthCookieName() {
  if (process.env.AUTH_COOKIE_NAME) {
    return process.env.AUTH_COOKIE_NAME;
  }
  if (process.env.FORUM_ID) {
    return `pbn_${process.env.FORUM_ID}_auth`;
  }
  return 'auth_token';
}

/**
 * @param {{ get: (name: string) => { name: string, value: string } | undefined, getAll?: () => Array<{ name: string, value: string }> }} cookieStore
 * @returns {{ name: string, value: string } | null}
 */
export function findAuthCookie(cookieStore) {
  const preferred = getAuthCookieName();
  const direct = cookieStore.get(preferred);
  if (direct?.value) {
    return { name: preferred, value: direct.value };
  }

  const all = typeof cookieStore.getAll === 'function' ? cookieStore.getAll() : [];
  for (const cookie of all) {
    if (!cookie?.value) continue;
    if (cookie.name === 'auth_token' || FORUM_AUTH_COOKIE_RE.test(cookie.name)) {
      return { name: cookie.name, value: cookie.value };
    }
  }

  return null;
}
