import dns from 'node:dns/promises';
import net from 'node:net';
import { normalizeUrl } from './engine.js';
export function publicIp(ip) {
  if (net.isIP(ip) !== 4) return false; // Conservative: IPv6/mapped addresses await an isolated verifier.
  const [a,b] = ip.split('.').map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0)) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && [18,19,51].includes(b)) || (a === 203 && b === 0));
}
export async function verifyDestination(value, lookup = dns.lookup) {
  let url;
  try { url = normalizeUrl(value); } catch { return { action: 'BLOCK', reason: 'UNSAFE_URL' }; }
  if (!['', '80', '443'].includes(url.port)) return { action: 'BLOCK', reason: 'UNSAFE_PORT' };
  let timer;
  try {
    const addresses = await Promise.race([lookup(url.hostname, {all:true}), new Promise((_,reject) => { timer=setTimeout(() => reject(new Error('timeout')),1000); })]);
    if (!addresses.length || addresses.some(a => !publicIp(a.address))) return {action:'BLOCK',reason:'NON_PUBLIC_DESTINATION'};
  } catch { return {action:'REVIEW',reason:'DESTINATION_UNVERIFIED'}; } finally {clearTimeout(timer);}
  // No HTTP request is made. DNS validation alone cannot prove a redirect safe, pin an IP,
  // or prevent rebinding. An unavailable reliable verifier must explicitly hold publication.
  return {action:'REVIEW',reason:'REDIRECT_VERIFIER_UNAVAILABLE'};
}
