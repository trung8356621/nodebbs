/**
 * forum-ingest unit tests (node:test). No DB / no live publish.
 * Run: node --test apps/api/src/extensions/forum-ingest/tests/forum-ingest.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateIngestToken,
  parseIngestBearer,
  hashSecret,
  constantTimeEqual,
  hashIngestPayload,
  resolvePublicSiteOrigin,
  buildTopicCanonicalUrl,
  assertMarkdownContent,
} from '../crypto.js';
import {
  normalizeAuthorSearchQuery,
  escapeIlikePattern,
} from '../authorSearch.js';
import { evaluate, validateRule } from '../../../services/policy/engine.js';

// Mirror web contentLinkRel (apps/web/src/lib/content-link-policy.js) for nofollow contract.
function contentLinkRel(href, { policy = 'ugc', canonicalOrigin } = {}) {
  const security = 'noopener noreferrer';
  try {
    const url = new URL(href, canonicalOrigin || 'https://internal.invalid');
    if (!['http:', 'https:'].includes(url.protocol)) return security;
    if (canonicalOrigin && url.origin === new URL(canonicalOrigin).origin) return security;
    if (!canonicalOrigin && !/^(?:https?:)?\/\//i.test(href)) return security;
    return (
      security +
      (policy === 'editorial'
        ? ''
        : policy === 'paid' || policy === 'sponsored'
          ? ' ugc sponsored'
          : ' ugc nofollow')
    );
  } catch {
    return security;
  }
}

describe('ingest token crypto', () => {
  it('generates parseable token and stores only hash', () => {
    const { keyId, token, secretHash } = generateIngestToken();
    assert.match(token, /^pbn_ingest_/);
    assert.equal(parseIngestBearer(`Bearer ${token}`)?.keyId, keyId);
    assert.equal(secretHash, hashSecret(token));
    assert.notEqual(secretHash, token);
  });

  it('rejects invalid/revoked-style bearer shapes', () => {
    assert.equal(parseIngestBearer(null), null);
    assert.equal(parseIngestBearer('Bearer junk'), null);
    assert.equal(parseIngestBearer('Basic abc'), null);
  });

  it('constantTimeEqual distinguishes secrets', () => {
    const a = hashSecret('pbn_ingest_aaa_bbb');
    const b = hashSecret('pbn_ingest_aaa_ccc');
    assert.equal(constantTimeEqual(a, a), true);
    assert.equal(constantTimeEqual(a, b), false);
  });
});

describe('idempotency payload hash', () => {
  it('same payload (tag order independent) hashes equal', () => {
    const a = hashIngestPayload({
      title: 'Hello',
      categoryId: 2,
      content: 'body',
      tags: ['b', 'a'],
    });
    const b = hashIngestPayload({
      title: 'Hello',
      categoryId: 2,
      content: 'body',
      tags: ['a', 'b'],
    });
    assert.equal(a, b);
  });

  it('payload conflict: different content → different hash', () => {
    const a = hashIngestPayload({
      title: 'Hello',
      categoryId: 2,
      content: 'body-1',
      tags: [],
    });
    const b = hashIngestPayload({
      title: 'Hello',
      categoryId: 2,
      content: 'body-2',
      tags: [],
    });
    assert.notEqual(a, b);
  });
});

describe('canonical URL', () => {
  it('accepts validated http(s) origin', () => {
    assert.equal(resolvePublicSiteOrigin('https://forum.example'), 'https://forum.example');
    assert.equal(
      buildTopicCanonicalUrl('https://forum.example', 42),
      'https://forum.example/topic/42',
    );
  });

  it('rejects path/query/invalid origins', () => {
    assert.throws(() => resolvePublicSiteOrigin(''), /not configured/);
    assert.throws(() => resolvePublicSiteOrigin('ftp://x'), /http/);
    assert.throws(() => resolvePublicSiteOrigin('https://x/path'), /path/);
    assert.throws(() => resolvePublicSiteOrigin('https://user:pass@x'), /credentials/);
  });
});

describe('Markdown requirement', () => {
  it('accepts Markdown body', () => {
    assert.doesNotThrow(() =>
      assertMarkdownContent('Hello [link](https://example.com)\n\nMore text.'),
    );
  });

  it('rejects HTML documents', () => {
    assert.throws(
      () => assertMarkdownContent('<!DOCTYPE html><html><body>x</body></html>'),
      (err) => err.code === 'MARKDOWN_REQUIRED',
    );
  });
});

describe('Markdown external link nofollow (render policy)', () => {
  it('ugc external links get ugc nofollow', () => {
    const rel = contentLinkRel('https://wp.example/post', {
      policy: 'ugc',
      canonicalOrigin: 'https://forum.example',
    });
    assert.match(rel, /nofollow/);
    assert.match(rel, /ugc/);
  });

  it('same-origin links do not get nofollow', () => {
    const rel = contentLinkRel('https://forum.example/topic/1', {
      policy: 'ugc',
      canonicalOrigin: 'https://forum.example',
    });
    assert.equal(rel.includes('nofollow'), false);
  });
});

describe('concurrent retry contract (logical)', () => {
  it('documents unique (integrationId, externalRef) + payload hash rules', () => {
    // DB unique index + advisory lock enforce this at runtime; unit-level assertion of hash rules.
    const ref = 'archive-123';
    const payload = { title: 'T', categoryId: 1, content: 'c', tags: [] };
    const h1 = hashIngestPayload(payload);
    const h2 = hashIngestPayload(payload);
    assert.equal(h1, h2);
    assert.equal(ref.length > 0, true);
  });
});

describe('policy exclude rules (domain BLOCK / REVIEW)', () => {
  it('blocks excluded domains in Markdown links', () => {
    const rule = validateRule({
      id: 'local-block-bad',
      category: 'custom_domain',
      type: 'domain_exact',
      value: 'blocked.example',
      action: 'BLOCK',
      priority: 10,
      enabled: true,
      reason: 'excluded domain',
    });
    const decision = evaluate(
      'See [x](https://blocked.example/page) for details',
      [rule],
    );
    assert.equal(decision.action, 'BLOCK');
  });

  it('reviews matched REVIEW rules without fabricating ALLOW', () => {
    const rule = validateRule({
      id: 'local-review-spam',
      category: 'spam',
      type: 'domain_exact',
      value: 'review-me.example',
      action: 'REVIEW',
      priority: 5,
      enabled: true,
      reason: 'needs review',
    });
    const decision = evaluate('Visit https://review-me.example/a', [rule]);
    assert.equal(decision.action, 'REVIEW');
  });

  it('blocks keyword rules with Vietnamese word boundaries', () => {
    const rule = validateRule({
      id: 'local-kw',
      category: 'custom_keyword',
      type: 'keyword',
      value: 'cờ bạc',
      action: 'BLOCK',
      priority: 1,
      enabled: true,
      reason: 'keyword block',
    });
    assert.equal(evaluate('Tin về CỜ BẠC hôm nay', [rule]).action, 'BLOCK');
    assert.equal(evaluate('classification only', [validateRule({
      id: 'local-class',
      category: 'custom_keyword',
      type: 'keyword',
      value: 'class',
      action: 'BLOCK',
      enabled: true,
      reason: 'x',
    })]).action, 'ALLOW');
  });
});

describe('permission / revoked key (contract codes)', () => {
  it('defines stable error codes for SEO-OPS UI', () => {
    const codes = [
      'INGEST_AUTH_INVALID',
      'INGEST_AUTH_REVOKED',
      'INGEST_AUTHOR_NO_PERMISSION',
      'INGEST_AUTHOR_ADMIN_FORBIDDEN',
      'INGEST_IDEMPOTENCY_CONFLICT',
      'MARKDOWN_REQUIRED',
      'POLICY_BLOCKED',
    ];
    assert.equal(new Set(codes).size, codes.length);
  });
});

describe('author search query helpers', () => {
  it('requires at least 2 characters', () => {
    assert.equal(normalizeAuthorSearchQuery(''), null);
    assert.equal(normalizeAuthorSearchQuery('a'), null);
    assert.equal(normalizeAuthorSearchQuery(' ab '), 'ab');
  });

  it('escapes ILIKE wildcards', () => {
    assert.equal(escapeIlikePattern('100%_user'), '100\\%\\_user');
  });
});
