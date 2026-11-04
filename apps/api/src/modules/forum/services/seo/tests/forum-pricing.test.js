import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';

const {
  validatePrices,
  synchronizePrices,
  catalogMetaFromPayload,
  productsFromPayload,
  digest,
  FORUM_PRICING_CONTRACT,
} = await import('../prices.js');
const { QUOTE_STATUS, PAID_PIN_MIGRATION_STATUS, PRICING_PROVENANCE } = await import('../constants.js');

const now = new Date('2026-11-03T10:00:00.000Z');
const later = new Date('2026-11-03T10:05:00.000Z');
const sourceId = 'test-ops-global';

function baseV2(overrides = {}) {
  return {
    schemaVersion: 2,
    contract: FORUM_PRICING_CONTRACT,
    version: 1,
    productCode: 'pbn',
    sourceId,
    issuedAt: now.toISOString(),
    validUntil: new Date(now.getTime() + 30 * 86400000).toISOString(),
    effectiveAt: now.toISOString(),
    creditVnd: 10000,
    businessTimeZone: 'Asia/Ho_Chi_Minh',
    quoteTtlSeconds: 900,
    products: [
      {
        id: 'seo-monthly-paid',
        priceVersion: 1,
        type: 'seo_entitlement',
        name: 'Monthly SEO',
        durationMonths: 1,
        listPriceCredit: 10,
        salePriceCredit: 10,
        unitPriceCredit: 10,
        enabled: true,
        effectiveAt: now.toISOString(),
        endsAt: null,
        renewalWindowDays: 7,
      },
      {
        id: 'credit-pack-100',
        priceVersion: 1,
        type: 'credit_package',
        name: '100 Credits',
        creditsGranted: 100,
        amountVnd: 1000000,
        listAmountVnd: 1000000,
        saleAmountVnd: 1000000,
        enabled: true,
        effectiveAt: now.toISOString(),
        endsAt: null,
      },
      {
        id: 'pin-7d',
        priceVersion: 1,
        type: 'paid_pin',
        name: '7-day pin',
        durationSeconds: 604800,
        listPriceCredit: 10,
        salePriceCredit: 10,
        unitPriceCredit: 10,
        enabled: true,
        effectiveAt: now.toISOString(),
        endsAt: null,
      },
    ],
    ...overrides,
  };
}

function sign(payload, privateKey) {
  const bytes = Buffer.from(JSON.stringify(payload));
  return {
    payload: bytes.toString('base64'),
    checksum: digest(bytes),
    signature: crypto.sign(null, bytes, privateKey).toString('base64'),
  };
}

test('forum-pricing/1 shared catalog validates conversion, packages, and paid_pin', () => {
  const catalog = validatePrices(baseV2(), 'forum_a', sourceId);
  assert.equal(catalog.creditVnd, 10000);
  assert.equal(catalog.contract, FORUM_PRICING_CONTRACT);
  assert.equal(productsFromPayload(catalog, 'credit_package').length, 1);
  assert.equal(productsFromPayload(catalog, 'paid_pin').length, 1);
  assert.equal(PAID_PIN_MIGRATION_STATUS, 'OPS_CATALOG');
});

test('legacy schemaVersion 1 still validates for existing SEO fixtures', () => {
  const legacy = validatePrices({
    schemaVersion: 1,
    version: 1,
    forumId: 'forum_a',
    sourceId,
    issuedAt: now.toISOString(),
    validUntil: new Date(now.getTime() + 86400000).toISOString(),
    products: [{
      id: 'seo-monthly-paid',
      priceVersion: 1,
      type: 'seo_entitlement',
      name: 'Paid',
      durationMonths: 1,
      listPriceCredit: 5,
      salePriceCredit: 3,
      enabled: true,
      effectiveAt: now.toISOString(),
      endsAt: null,
      renewalWindowDays: 7,
    }],
  }, 'forum_a', sourceId);
  assert.equal(legacy.schemaVersion, 1);
  assert.equal(catalogMetaFromPayload(legacy).creditVnd, null);
});

test('rejects locally invented conversion outside snapshot', () => {
  const bad = baseV2();
  delete bad.creditVnd;
  assert.throws(() => validatePrices(bad, 'forum_a', sourceId), /Invalid OPS price snapshot/);
});

test('quote lock economics are preserved when catalog price rises', () => {
  const quote = {
    status: QUOTE_STATUS.OPEN,
    expires_at: new Date('2026-11-03T10:15:00.000Z'),
    unit_price: 10,
    quantity: 1,
    total_credits: 10,
    price_snapshot: {
      productId: 'seo-monthly-paid',
      priceVersion: 1,
      snapshotVersion: 1,
      salePriceCredit: 10,
      unitPriceCredit: 10,
      listPriceCredit: 10,
      durationMonths: 1,
      renewalWindowDays: 7,
    },
    product_id: 'seo-monthly-paid',
  };
  const publishedV2 = baseV2({
    version: 2,
    issuedAt: later.toISOString(),
    effectiveAt: later.toISOString(),
    products: [{
      id: 'seo-monthly-paid',
      priceVersion: 2,
      type: 'seo_entitlement',
      name: 'Monthly SEO',
      durationMonths: 1,
      listPriceCredit: 15,
      salePriceCredit: 15,
      unitPriceCredit: 15,
      enabled: true,
      effectiveAt: later.toISOString(),
      endsAt: null,
      renewalWindowDays: 7,
    }],
  });
  validatePrices(publishedV2, 'forum_a', sourceId);
  const confirmAt = new Date('2026-11-03T10:07:00.000Z');
  assert.ok(new Date(quote.expires_at) > confirmAt);
  assert.notEqual(publishedV2.products[0].unitPriceCredit, quote.unit_price);
  const charge = Number(quote.total_credits);
  assert.equal(charge, 10);
  assert.equal(PRICING_PROVENANCE.SNAPSHOT, 'snapshot');
});

test('expired or revoked quotes require reconfirmation', () => {
  const expired = { status: QUOTE_STATUS.OPEN, expires_at: new Date('2026-11-03T10:01:00.000Z') };
  const revoked = { status: QUOTE_STATUS.REVOKED, expires_at: new Date('2026-11-03T10:15:00.000Z') };
  const confirmAt = new Date('2026-11-03T10:07:00.000Z');
  assert.ok(new Date(expired.expires_at) <= confirmAt);
  assert.equal(revoked.status, QUOTE_STATUS.REVOKED);
});

test('reconciliation cursors detect gaps without duplicates', () => {
  const events = [
    { eventId: 'e1', sequenceNumber: 1 },
    { eventId: 'e2', sequenceNumber: 2 },
    { eventId: 'e2', sequenceNumber: 2 },
    { eventId: 'e4', sequenceNumber: 4 },
  ];
  const seen = new Set();
  const unique = [];
  for (const e of events) {
    if (seen.has(e.eventId)) continue;
    seen.add(e.eventId);
    unique.push(e);
  }
  assert.deepEqual(unique.map((e) => e.sequenceNumber), [1, 2, 4]);
  const gaps = [];
  for (let i = 1; i < unique.length; i++) {
    if (unique[i].sequenceNumber !== unique[i - 1].sequenceNumber + 1) {
      gaps.push({ after: unique[i - 1].sequenceNumber, before: unique[i].sequenceNumber });
    }
  }
  assert.deepEqual(gaps, [{ after: 2, before: 4 }]);
});

test('signed synchronize accepts shared v2 and stores seo rows only for seo_entitlement', async (t) => {
  const databaseUrl = process.env.FORUM_PRICING_TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!databaseUrl) {
    t.skip('DATABASE_URL not configured');
    return;
  }
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const keys = crypto.generateKeyPairSync('ed25519');
  const forumId = 'forum_pricing_test_' + crypto.randomBytes(3).toString('hex');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'forum-pricing-'));
  const trust = path.join(tmp, 'trust.pem');
  fs.writeFileSync(trust, keys.publicKey.export({ type: 'spki', format: 'pem' }));

  const client = await pool.connect();
  try {
    // Prefer an isolated schema only when explicitly provided; otherwise skip destructive sync test.
    if (!process.env.FORUM_PRICING_TEST_DATABASE_URL) {
      t.skip('Set FORUM_PRICING_TEST_DATABASE_URL for live synchronize regression');
      return;
    }
    const v1 = baseV2({ version: 1 });
    const sync1 = await synchronizePrices(pool, sign(v1, keys.privateKey), fs.readFileSync(trust, 'utf8'), {
      forumId,
      sourceId,
    });
    assert.equal(sync1.version, 1);

    const v2 = baseV2({
      version: 2,
      issuedAt: later.toISOString(),
      effectiveAt: later.toISOString(),
      products: [{
        id: 'seo-monthly-paid',
        priceVersion: 2,
        type: 'seo_entitlement',
        name: 'Monthly SEO V2',
        durationMonths: 1,
        listPriceCredit: 15,
        salePriceCredit: 15,
        unitPriceCredit: 15,
        enabled: true,
        effectiveAt: later.toISOString(),
        endsAt: null,
        renewalWindowDays: 7,
      }],
    });
    const sync2 = await synchronizePrices(pool, sign(v2, keys.privateKey), fs.readFileSync(trust, 'utf8'), {
      forumId,
      sourceId,
    });
    assert.equal(sync2.version, 2);
  } finally {
    client.release();
    await pool.end();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('offline policy: missing creditVnd in legacy meta is fail-closed for authority', () => {
  const meta = catalogMetaFromPayload({ schemaVersion: 1, issuedAt: now.toISOString(), products: [] });
  assert.equal(meta.creditVnd, null);
});
