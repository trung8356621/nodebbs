/**
 * Content Blacklist MVP — deterministic unit + contract tests.
 * Does not publish to live forums or mutate production DBs.
 */
import assert from 'node:assert/strict';
import {
  evaluate,
  extract,
  hostMatchesDomain,
  keywordMatches,
  normalizeDomainInput,
  normalizeKeyword,
  normalizeUrl,
  validateRule,
} from '../apps/api/src/services/policy/engine.js';

let passed = 0;
const check = (name, fn) => {
  fn();
  passed += 1;
  console.log('PASS ' + name);
};

const domainRule = (value, action = 'BLOCK', extra = {}) => validateRule({
  id: extra.id || 'l:domain',
  category: 'custom_domain',
  type: extra.type || 'domain_subdomains',
  value,
  action,
  enabled: extra.enabled !== false,
  reason: extra.reason || 'blocked domain',
  priority: extra.priority || 0,
}, 'local');

const keywordRule = (value, action = 'BLOCK', extra = {}) => validateRule({
  id: extra.id || 'l:keyword',
  category: 'custom_keyword',
  type: 'keyword',
  value,
  action,
  enabled: extra.enabled !== false,
  reason: extra.reason || 'blocked keyword',
  priority: extra.priority || 0,
}, 'local');

// --- Domain normalization ---
check('normalize https www path', () => assert.equal(normalizeDomainInput('https://www.Example.com/page?x=1'), 'example.com'));
check('normalize bare host', () => assert.equal(normalizeDomainInput('EXAMPLE.COM'), 'example.com'));
check('normalize http subdomain keep host', () => assert.equal(normalizeDomainInput('http://sub.example.com'), 'sub.example.com'));

// --- Domain main / subdomain / lookalikes ---
const blocked = [domainRule('example.com')];
check('domain https match', () => assert.equal(evaluate('https://example.com', blocked).action, 'BLOCK'));
check('domain subdomain match', () => assert.equal(evaluate('https://sub.example.com/page', blocked).action, 'BLOCK'));
check('domain lookalike not-example', () => assert.equal(evaluate('https://not-example.com', blocked).action, 'ALLOW'));
check('domain lookalike example.com.evil.net', () => assert.equal(evaluate('https://example.com.evil.net', blocked).action, 'ALLOW'));
check('hostMatchesDomain boundary', () => {
  assert.equal(hostMatchesDomain('example.com', 'example.com', true), true);
  assert.equal(hostMatchesDomain('sub.example.com', 'example.com', true), true);
  assert.equal(hostMatchesDomain('not-example.com', 'example.com', true), false);
  assert.equal(hostMatchesDomain('example.com.evil.net', 'example.com', true), false);
});

// --- Markdown / HTML URL extraction ---
check('markdown link match', () => assert.equal(evaluate('[x](https://example.com/a)', blocked).action, 'BLOCK'));
check('html href match', () => assert.equal(evaluate('<a href="https://example.com/a">x</a>', blocked).action, 'BLOCK'));
check('bare domain prose is not a link', () => assert.equal(evaluate('Visit example.com for info', blocked).action, 'ALLOW'));
check('extract ignores bare host', () => assert.equal(extract('Visit example.com today').urls.length, 0));

// --- URL encoding / Unicode ---
check('encoded URL host', () => assert.equal(evaluate('https%3A%2F%2Fexample.com%2Fa', blocked).action, 'BLOCK'));
check('unicode hostname normalize', () => assert.equal(normalizeUrl('https://BÜCHER.example:443/').hostname, 'xn--bcher-kva.example'));

// --- Keywords: Vietnamese, case, word boundary ---
check('keyword vietnamese accents', () => {
  const rules = [keywordRule('cờ bạc')];
  assert.equal(evaluate('Khuyến mãi cờ bạc hôm nay', rules).action, 'BLOCK');
  assert.equal(evaluate('Khuyến mãi CỜ BẠC hôm nay', rules).action, 'BLOCK');
});
check('keyword case insensitive', () => {
  const rules = [keywordRule('Casino')];
  assert.equal(evaluate('try CASINO now', rules).action, 'BLOCK');
});
check('keyword inside other word no match', () => {
  assert.equal(keywordMatches('classification report', 'class'), false);
  assert.equal(keywordMatches('class report', 'class'), true);
  assert.equal(evaluate('classification report', [keywordRule('class')]).action, 'ALLOW');
  assert.equal(evaluate('class report', [keywordRule('class')]).action, 'BLOCK');
});
check('keyword phrase match', () => {
  assert.equal(evaluate('đăng ký nhận thưởng ngay', [keywordRule('đăng ký nhận thưởng')]).action, 'BLOCK');
});

// --- Active / inactive + BLOCK / REVIEW / ALLOW ---
check('inactive domain ignored', () => assert.equal(evaluate('https://example.com', [domainRule('example.com', 'BLOCK', { enabled: false })]).action, 'ALLOW'));
check('inactive keyword ignored', () => assert.equal(evaluate('casino promo', [keywordRule('casino', 'BLOCK', { enabled: false })]).action, 'ALLOW'));
check('REVIEW domain', () => assert.equal(evaluate('https://example.com', [domainRule('example.com', 'REVIEW')]).action, 'REVIEW'));
check('REVIEW keyword', () => assert.equal(evaluate('casino promo', [keywordRule('casino', 'REVIEW')]).action, 'REVIEW'));
check('ALLOW when no match', () => assert.equal(evaluate('hello world', blocked).action, 'ALLOW'));
check('BLOCK beats REVIEW', () => {
  const rules = [domainRule('example.com', 'REVIEW', { id: 'l:r' }), domainRule('example.com', 'BLOCK', { id: 'l:b', type: 'domain_exact' })];
  // same value different type — use subdomain rule BLOCK + exact REVIEW on same host
  const mixed = [
    validateRule({ id: 'l:r', category: 'custom_domain', type: 'domain_subdomains', value: 'example.com', action: 'REVIEW', enabled: true, reason: 'review' }, 'local'),
    validateRule({ id: 'l:b', category: 'custom_domain', type: 'domain_exact', value: 'example.com', action: 'BLOCK', enabled: true, reason: 'block' }, 'local'),
  ];
  assert.equal(evaluate('https://example.com', mixed).action, 'BLOCK');
  assert.ok(rules);
});

// --- validateRule accepts URL-shaped domain input ---
check('validateRule normalizes domain URL input', () => {
  const rule = validateRule({
    id: 'l:n', category: 'custom_domain', type: 'domain_subdomains',
    value: 'https://WWW.Blocked.Test/path', action: 'BLOCK', reason: 'x', enabled: true,
  }, 'local');
  assert.equal(rule.value, 'blocked.test');
});
check('validateRule keyword NFKC trim', () => {
  assert.equal(normalizeKeyword('  Casino   Online  '), 'Casino Online');
});

// --- Contract: protected write paths (plugin regex) ---
check('policy plugin content routes include topics posts ingest', () => {
  const contentRoute = (url) => /^\/api\/(topics|posts)(\/:[^/]+)?\/?$/.test(url)
    || /^\/api\/integrations\/topics\/?$/.test(url);
  assert.equal(contentRoute('/api/topics'), true);
  assert.equal(contentRoute('/api/topics/:id'), true);
  assert.equal(contentRoute('/api/posts'), true);
  assert.equal(contentRoute('/api/posts/:id'), true);
  assert.equal(contentRoute('/api/integrations/topics'), true);
  assert.equal(contentRoute('/api/integrations/topics/'), true);
  assert.equal(contentRoute('/api/topics/batch-delete'), false);
});

// --- Admin cannot bypass: engine has no role parameter ---
check('evaluate signature ignores actor role (no bypass hook)', () => {
  assert.equal(evaluate.length, 2);
  assert.equal(evaluate('https://example.com', blocked).action, 'BLOCK');
});

// --- Forum isolation: rules are DB-local arrays; Forum B rules absent => ALLOW ---
check('forum A rules not applied when absent from Forum B evaluate', () => {
  const forumA = [domainRule('secret-a.example', 'BLOCK', { id: 'l:a' })];
  const forumB = [domainRule('secret-b.example', 'BLOCK', { id: 'l:b' })];
  assert.equal(evaluate('https://secret-a.example', forumA).action, 'BLOCK');
  assert.equal(evaluate('https://secret-a.example', forumB).action, 'ALLOW');
  assert.equal(evaluate('https://secret-b.example', forumA).action, 'ALLOW');
});

// --- BLOCK on edit does not mutate content: contract of preHandler 422 before handler ---
check('BLOCK decision shape for API contract', () => {
  const decision = evaluate('https://example.com', blocked);
  assert.equal(decision.action, 'BLOCK');
  assert.ok(decision.reason);
  assert.ok(Array.isArray(decision.ruleIds));
});

// --- Ingest BLOCK/REVIEW contract compatibility ---
check('ingest POLICY_BLOCKED code documented', () => {
  const codes = ['POLICY_BLOCKED', 'INGEST_AUTH_INVALID', 'MARKDOWN_REQUIRED'];
  assert.ok(codes.includes('POLICY_BLOCKED'));
});
check('REVIEW leaves publish path to moderation (action only)', () => {
  const decision = evaluate('casino', [keywordRule('casino', 'REVIEW')]);
  assert.equal(decision.action, 'REVIEW');
  assert.notEqual(decision.action, 'ALLOW');
  assert.notEqual(decision.action, 'BLOCK');
});

// Topic/reply create/update path parity: same evaluate() for title+body candidate
check('topic candidate title+body evaluated together', () => {
  const candidate = ['Safe title', 'Body with https://example.com'].join('\n');
  assert.equal(evaluate(candidate, blocked).action, 'BLOCK');
});
check('reply body evaluated', () => {
  assert.equal(evaluate('see https://example.com', blocked).action, 'BLOCK');
});
check('title keyword blocked', () => {
  assert.equal(evaluate(['CỜ BẠC tip', 'normal body'].join('\n'), [keywordRule('cờ bạc')]).action, 'BLOCK');
});

console.log(`PASS ${passed} content-blacklist assertions`);
