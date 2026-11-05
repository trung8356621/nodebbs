/** @param {string} query @returns {string|null} trimmed query or null if too short */
export function normalizeAuthorSearchQuery(query) {
  const q = String(query || '').trim();
  return q.length >= 2 ? q : null;
}

/** Escape ILIKE wildcards for safe partial match. */
export function escapeIlikePattern(value) {
  return String(value).replace(/[%_\\]/g, '\\$&');
}
