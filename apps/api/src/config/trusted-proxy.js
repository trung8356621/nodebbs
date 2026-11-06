/**
 * Fastify trustProxy allowlist.
 * Only a connecting address on this list may supply X-Forwarded-For / X-Forwarded-Proto.
 * `true`, `*`, and catch-all CIDRs are rejected.
 */

const UNIVERSAL = new Set(['true', 'yes', 'all', '*', '0.0.0.0/0', '::/0']);
const DEFAULT_PROXIES = '127.0.0.1,::1';

/**
 * @param {string} address
 * @returns {string}
 */
export function normalizeIp(address) {
  let value = String(address || '').trim().toLowerCase();
  if (value.startsWith('::ffff:')) value = value.slice('::ffff:'.length);
  return value;
}

/**
 * @param {string} ip
 * @returns {number | null}
 */
function ipv4ToInt(ip) {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = ((value << 8) + octet) >>> 0;
  }
  return value;
}

/**
 * @param {string} entry
 * @returns {{ kind: 'exact', ip: string } | { kind: 'cidr4', network: number, mask: number }}
 */
function compileEntry(entry) {
  const value = normalizeIp(entry);
  if (!value || UNIVERSAL.has(value)) {
    throw new Error(`Refusing trusted proxy entry "${entry}"`);
  }
  if (value.includes('/')) {
    const [network, bitsRaw] = value.split('/');
    const bits = Number(bitsRaw);
    const networkInt = ipv4ToInt(network);
    if (networkInt == null || !Number.isInteger(bits) || bits < 0 || bits > 32 || bitsRaw !== String(bits)) {
      throw new Error(`Unsupported trusted proxy CIDR "${entry}"`);
    }
    if (bits === 0) throw new Error(`Refusing trusted proxy entry "${entry}"`);
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return { kind: 'cidr4', network: networkInt & mask, mask };
  }
  if (value.includes(':') || ipv4ToInt(value) != null) {
    return { kind: 'exact', ip: value };
  }
  throw new Error(`Unsupported trusted proxy entry "${entry}"`);
}

/**
 * @param {string | undefined} raw
 */
export function compileTrustedProxies(raw) {
  const source = raw == null || String(raw).trim() === '' ? DEFAULT_PROXIES : String(raw);
  if (UNIVERSAL.has(source.trim().toLowerCase())) {
    throw new Error('Refusing trustProxy=true; set TRUSTED_PROXIES to explicit proxy addresses');
  }
  const rules = source.split(',').map((item) => item.trim()).filter(Boolean).map(compileEntry);
  if (!rules.length) throw new Error('TRUSTED_PROXIES is empty');
  return rules;
}

/**
 * @param {string} address
 * @param {ReturnType<typeof compileTrustedProxies>} rules
 */
export function isTrustedProxyAddress(address, rules) {
  const ip = normalizeIp(address);
  const v4 = ipv4ToInt(ip);
  return rules.some((rule) => {
    if (rule.kind === 'exact') return rule.ip === ip;
    return v4 != null && (v4 & rule.mask) === rule.network;
  });
}

/**
 * Fastify calls this once per hop. A hop is trusted only when its address is listed.
 * Unlisted addresses, including a client-supplied X-Forwarded-For hop, stop the walk.
 *
 * @param {NodeJS.ProcessEnv} env
 */
export function trustProxyFromEnv(env = process.env) {
  const rules = compileTrustedProxies(env.TRUSTED_PROXIES);
  return function trustProxy(address) {
    return isTrustedProxyAddress(address, rules);
  };
}

/**
 * Fastify's request.protocol honors X-Forwarded-Proto for every peer once
 * trustProxy is set. Cookie Secure must follow only a trusted hop, or the socket.
 *
 * @param {{ headers?: Record<string, string | string[] | undefined>, socket?: { remoteAddress?: string, encrypted?: boolean }, raw?: { socket?: { remoteAddress?: string, encrypted?: boolean } } }} request
 * @param {(address: string) => boolean} trust
 * @returns {'http' | 'https'}
 */
export function trustedProtocol(request, trust) {
  const socket = request.raw?.socket || request.socket;
  const peer = socket?.remoteAddress || '';
  if (trust(peer)) {
    const header = request.headers?.['x-forwarded-proto'];
    const value = Array.isArray(header) ? header.at(-1) : header;
    const proto = String(value || '').split(',').at(-1).trim().toLowerCase();
    if (proto === 'https' || proto === 'http') return proto;
  }
  return socket?.encrypted ? 'https' : 'http';
}
