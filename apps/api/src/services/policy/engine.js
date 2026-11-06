import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { parseFragment } from 'parse5';
import { domainToASCII } from 'node:url';

export const categories = ['gambling_promotion', 'phishing', 'malware', 'fraud', 'spam', 'custom_domain', 'custom_url', 'custom_keyword'];
export const types = ['domain_exact', 'domain_subdomains', 'url_exact', 'url_prefix', 'text_signals', 'verify_redirect', 'keyword'];
const parser = unified().use(remarkParse).use(remarkGfm);

function decode(value) {
  let text = String(value).trim();
  for (let i = 0; i < 2; i++) {
    const node = parseFragment(text);
    const joined = node.childNodes?.map(n => n.value || '').join('');
    if (joined) text = joined;
    if (/^https?%3a/i.test(text)) { try { text = decodeURIComponent(text); } catch { break; } }
  }
  return text;
}

export function urlField(value) {
  if (!value) return '';
  const escaped = String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  return '<a href="' + escaped + '">outbound</a>';
}

export function normalizeUrl(value) {
  const raw = decode(value);
  const url = new URL(raw.startsWith('//') ? 'https:' + raw : raw);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Unsafe URL');
  url.hostname = domainToASCII(url.hostname.replace(/\.+$/, '').toLowerCase());
  if (!url.hostname) throw new Error('Invalid hostname');
  url.hash = '';
  try { url.pathname = decodeURIComponent(url.pathname); } catch { throw new Error('Invalid URL encoding'); }
  for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
  url.searchParams.sort();
  return url;
}

/**
 * Normalize admin/domain-rule input: accept bare hosts or http(s)/www URLs.
 * Strips scheme, credentials, port, path/query/hash and a single leading www.
 */
export function normalizeDomainInput(value) {
  let raw = String(value || '').trim();
  if (!raw) throw new Error('Invalid hostname');
  if (/^https?:\/\//i.test(raw) || raw.startsWith('//')) {
    raw = normalizeUrl(raw).hostname;
  } else {
    raw = raw.replace(/^[^@\s]+@/, '');
    raw = raw.split(/[/?#]/)[0];
    raw = raw.replace(/:\d+$/, '').replace(/\.+$/, '').toLowerCase();
    if (raw.startsWith('www.')) raw = raw.slice(4);
    raw = normalizeUrl('https://' + raw).hostname;
  }
  if (raw.startsWith('www.')) raw = raw.slice(4);
  if (!raw || /[/:?#@\s]/.test(raw)) throw new Error('Use a normalized ASCII hostname');
  return raw;
}

export function normalizeKeyword(value) {
  const keyword = String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ');
  if (!keyword || keyword.length > 200) throw new Error('Invalid keyword');
  return keyword;
}

/** Unicode-aware whole-word / whole-phrase match (case-insensitive via pre-normalized text). */
export function keywordMatches(text, keyword) {
  const needle = normalizeKeyword(keyword).toLowerCase();
  const haystack = String(text || '').normalize('NFKC').toLowerCase();
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
  return new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, 'u').test(haystack);
}

export function hostMatchesDomain(host, ruleHost, includeSubdomains) {
  if (!host || !ruleHost) return false;
  if (host === ruleHost) return true;
  return includeSubdomains ? host.endsWith('.' + ruleHost) : false;
}

export function extract(content) {
  const urls = new Set();
  const texts = [];
  function html(value) {
    function walk(n) {
      if (n.value) texts.push(n.value);
      for (const a of n.attrs || []) {
        if (['href', 'src', 'action', 'poster', 'data'].includes(a.name)) urls.add(a.value);
        if (a.name === 'srcset') for (const part of a.value.split(',')) urls.add(part.trim().split(/\s/)[0]);
      }
      for (const child of n.childNodes || []) walk(child);
      if (n.content) walk(n.content);
    }
    walk(parseFragment(value));
  }
  function walk(n) {
    if (n.url) urls.add(n.url);
    if (n.type === 'html') html(n.value);
    else if (n.value) texts.push(n.value);
    for (const child of n.children || []) walk(child);
  }
  walk(parser.parse(String(content || '')));
  // Only real http(s) URLs count as outbound links — bare "example.com" in prose does not.
  for (const match of decode(String(content || '')).matchAll(/https?(?::\/\/|%3a%2f%2f)[^\s<>"'`]+/gi)) urls.add(match[0].replace(/[),.;!?]+$/, ''));
  for (const text of texts) for (const match of text.matchAll(/https?:\/\/[^\s<>"']+/gi)) urls.add(match[0].replace(/[),.;!?]+$/, ''));
  const normalized = [], invalid = [];
  for (const url of urls) {
    if (/^(#|\/[^/])/.test(url)) continue;
    try { normalized.push(normalizeUrl(url)); } catch { invalid.push(url); }
  }
  return { urls: normalized, invalid, text: texts.join(' ').normalize('NFKC').toLowerCase() };
}

export function validateRule(rule, scope = 'local') {
  if (!rule || !categories.includes(rule.category) || !types.includes(rule.type) || !['ALLOW', 'REVIEW', 'BLOCK'].includes(rule.action)) throw new Error('Invalid rule');
  if (typeof rule.value !== 'string' || !rule.value.trim() || rule.value.length > 4000 || typeof rule.reason !== 'string' || rule.reason.length > 500 || !rule.reason.trim()) throw new Error('Invalid rule value/reason');
  let value = rule.value.trim();
  if (rule.type.startsWith('domain_') || rule.type === 'verify_redirect') {
    value = normalizeDomainInput(value);
  }
  if (rule.type.startsWith('url_')) normalizeUrl(value);
  if (rule.type === 'verify_redirect' && rule.action !== 'REVIEW') throw new Error('Unverified redirects require REVIEW');
  if (rule.type === 'text_signals') {
    const signals = JSON.parse(value);
    if (!Array.isArray(signals.subject) || !signals.subject.length || !Array.isArray(signals.promotion) || !signals.promotion.length || [...signals.subject, ...signals.promotion, ...(signals.context || [])].some(v => typeof v !== 'string' || !v.trim() || v.length > 150)) throw new Error('Invalid contextual signals');
  }
  if (rule.type === 'keyword') {
    value = normalizeKeyword(value);
  }
  return { id: rule.id, scope, category: rule.category, type: rule.type, value, action: rule.action, priority: Number.isInteger(rule.priority) ? Math.max(-1000, Math.min(1000, rule.priority)) : 0, enabled: rule.enabled !== false, reason: rule.reason };
}

export function evaluate(content, rules) {
  if (String(content).length > 200000) return { action: 'BLOCK', ruleIds: [], reason: 'CONTENT_LIMIT_EXCEEDED' };
  const input = extract(content), matched = [];
  for (const rule of rules.filter(r => r.enabled).sort((a, b) => (a.scope === 'global' ? 0 : 1) - (b.scope === 'global' ? 0 : 1) || b.priority - a.priority || a.id.localeCompare(b.id))) {
    let hit = false, action = rule.action;
    if (rule.type === 'text_signals') {
      const s = JSON.parse(rule.value), has = list => list.some(v => input.text.includes(v.normalize('NFKC').toLowerCase()));
      hit = has(s.subject) && has(s.promotion);
      // Discussion/warnings with promotional quotations are ambiguous, never classified as legal fact.
      if (hit && s.context?.length && has(s.context)) action = 'REVIEW';
    } else if (rule.type === 'keyword') {
      hit = keywordMatches(input.text, rule.value);
    } else {
      hit = input.urls.some(url => {
        const host = url.hostname;
        if (['domain_exact', 'verify_redirect'].includes(rule.type)) return hostMatchesDomain(host, rule.value, false);
        if (rule.type === 'domain_subdomains') return hostMatchesDomain(host, rule.value, true);
        const expected = normalizeUrl(rule.value);
        if (rule.type === 'url_exact') return url.href === expected.href;
        if (rule.type === 'url_prefix') return url.origin === expected.origin && (url.pathname === expected.pathname || url.pathname.startsWith(expected.pathname.replace(/\/$/, '') + '/'));
        return false;
      });
    }
    if (hit) matched.push({ ...rule, action });
  }
  const unsafe = input.invalid.some(value => /^(javascript|data|vbscript|file|blob):/i.test(value.trim()));
  const action = unsafe || matched.some(r => r.action === 'BLOCK') ? 'BLOCK' : matched.some(r => r.action === 'REVIEW') || input.invalid.length ? 'REVIEW' : 'ALLOW';
  return { action, ruleIds: matched.map(r => r.id), reason: unsafe ? 'UNSAFE_URL_SCHEME' : action === 'ALLOW' ? 'POLICY_ALLOWED' : input.invalid.length ? 'URL_REQUIRES_REVIEW' : matched.filter(r => r.action === action).map(r => r.reason).join('; ').slice(0, 1000) };
}
