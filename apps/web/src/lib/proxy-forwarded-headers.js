/**
 * Forwarded-header handling for the Next rewrite in front of the API.
 * The left side of X-Forwarded-For is client-controlled. Only the rightmost
 * hop — the address appended by the closest proxy, or the socket address Next
 * recorded when the header was absent — is sent onward.
 */

/**
 * @param {string | null | undefined} peerAddress
 * @param {string | undefined} trustedEdges raw TRUSTED_EDGE_PROXIES
 */
export function edgeMayKeepForwardedHeaders(peerAddress, trustedEdges) {
  const peer = String(peerAddress || '').trim().toLowerCase().replace(/^::ffff:/, '');
  const allowed = String(trustedEdges || '')
    .split(',')
    .map((item) => item.trim().toLowerCase().replace(/^::ffff:/, ''))
    .filter(Boolean);
  return Boolean(peer) && allowed.includes(peer);
}

/**
 * Strip client forwarding headers unless this TCP peer is an operator-listed edge.
 * Next then fills X-Forwarded-For from the socket when the header is missing.
 *
 * @param {import('node:http').IncomingHttpHeaders} headers
 * @param {{ peerAddress?: string, trustedEdges?: string, socketEncrypted?: boolean }} context
 */
export function sanitizeEdgeHeaders(headers, context = {}) {
  if (edgeMayKeepForwardedHeaders(context.peerAddress, context.trustedEdges)) return headers;
  delete headers['x-forwarded-for'];
  delete headers['x-real-ip'];
  if (!context.socketEncrypted) delete headers['x-forwarded-proto'];
  return headers;
}

/**
 * @param {Headers} incoming
 * @returns {Headers}
 */
export function headersForApiProxy(incoming) {
  const headers = new Headers(incoming);
  const hops = String(headers.get('x-forwarded-for') || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  headers.delete('x-forwarded-for');
  headers.delete('x-real-ip');
  if (hops.length) headers.set('x-forwarded-for', hops[hops.length - 1]);
  const proto = String(headers.get('x-forwarded-proto') || '').split(',')[0].trim().toLowerCase();
  if (proto === 'http' || proto === 'https') headers.set('x-forwarded-proto', proto);
  else headers.delete('x-forwarded-proto');
  return headers;
}
