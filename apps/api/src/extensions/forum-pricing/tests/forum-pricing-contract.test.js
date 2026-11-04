import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canonicalJsonStringify,
  verifyForumPricingSnapshot,
  signForumPricingBody,
  exportSpkiBase64Url,
  snapshotWithoutSignature,
} from '../crypto.js';
import { validateForumPricingSnapshot } from '../validate.js';
import { viewFromSnapshot } from '../services/catalogView.js';
import { FORUM_PRICING_CONTRACT, PAID_PIN_MIGRATION_STATUS } from '../constants.js';
import { clearTrustedKeyRegistryCache, resolveTrustedVerification } from '../trust.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../../../');
const contractDir = path.join(root, 'contracts/forum-pricing/v1');

function loadJson(name) {
  return JSON.parse(fs.readFileSync(path.join(contractDir, name), 'utf8'));
}

function makeKeys(keyId = 'fpk_v1') {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  return {
    keyId,
    privateKey,
    publicKey,
    publicKeySpkiBase64Url: exportSpkiBase64Url(publicKey),
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  };
}

function unsignedBody(overrides = {}) {
  const example = loadJson('snapshot.example.json');
  const { signature, ...rest } = example;
  return {
    ...rest,
    issuedAt: '2026-11-03T00:00:00.000Z',
    effectiveAt: '2026-11-03T00:00:00.000Z',
    validUntil: null,
    ...overrides,
  };
}

function pinTrust(keys) {
  clearTrustedKeyRegistryCache();
  process.env.FORUM_PRICING_TRUSTED_KEYS_JSON = JSON.stringify([{
    keyId: keys.keyId,
    publicKey: keys.publicKeySpkiBase64Url,
    status: 'active',
  }]);
}

test('OPS contract fixtures are present (forum-pricing/1)', () => {
  for (const name of [
    'protocol.md',
    'signing.md',
    'snapshot.example.json',
    'sync-response.example.json',
    'credit-order.request.json',
    'free-launch-order.request.json',
    'quote.request.json',
    'failure-matrix.md',
  ]) {
    assert.ok(fs.existsSync(path.join(contractDir, name)), name);
  }
  const snap = loadJson('snapshot.example.json');
  assert.equal(snap.schemaVersion, FORUM_PRICING_CONTRACT);
  assert.equal(snap.productKey, 'pbn');
  assert.equal(typeof snap.vndPerCredit, 'number');
  assert.ok(Array.isArray(snap.creditPackages));
  assert.ok(Array.isArray(snap.seoServices));
  assert.ok(Array.isArray(snap.paidPins));
  assert.equal(typeof snap.freeLaunch.enabled, 'boolean');
});

test('canonical JSON sorts nested keys like OPS', () => {
  const a = canonicalJsonStringify({ b: 1, a: { d: 2, c: 3 } });
  const b = canonicalJsonStringify({ a: { c: 3, d: 2 }, b: 1 });
  assert.equal(a, b);
  assert.equal(a, '{"a":{"c":3,"d":2},"b":1}');
});

test('OPS publisher → PBN verifier accepts valid V1 snapshot via trust registry', () => {
  const keys = makeKeys();
  pinTrust(keys);
  const body = unsignedBody({ version: 1, pricingVersionId: 'fpv_test_1' });
  const signed = signForumPricingBody(body, keys.privateKeyPem, keys.keyId);
  validateForumPricingSnapshot(signed);
  const trust = resolveTrustedVerification(signed.signature.keyId, {
    keyId: keys.keyId,
    publicKey: keys.publicKeySpkiBase64Url,
  });
  assert.equal(trust.ok, true);
  const result = verifyForumPricingSnapshot(signed, trust.verification);
  assert.equal(result.ok, true);
});

test('tampered catalog is rejected', () => {
  const keys = makeKeys();
  pinTrust(keys);
  const signed = signForumPricingBody(unsignedBody(), keys.privateKeyPem, keys.keyId);
  signed.vndPerCredit = 999999;
  const trust = resolveTrustedVerification(signed.signature.keyId);
  const result = verifyForumPricingSnapshot(signed, trust.verification);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'signature_mismatch');
});

test('wrong key is rejected by trust registry', () => {
  const a = makeKeys('fpk_a');
  const b = makeKeys('fpk_b');
  pinTrust(a);
  const signed = signForumPricingBody(unsignedBody(), a.privateKeyPem, a.keyId);
  const wrongSyncKey = resolveTrustedVerification(signed.signature.keyId, {
    keyId: a.keyId,
    publicKey: b.publicKeySpkiBase64Url,
  });
  assert.equal(wrongSyncKey.ok, false);
  assert.equal(wrongSyncKey.reason, 'untrusted_sync_public_key');
  const signedOther = signForumPricingBody(unsignedBody({ pricingVersionId: 'fpv_x' }), b.privateKeyPem, b.keyId);
  const unknown = resolveTrustedVerification(signedOther.signature.keyId, {
    keyId: b.keyId,
    publicKey: b.publicKeySpkiBase64Url,
  });
  assert.equal(unknown.ok, false);
  assert.equal(unknown.reason, 'unknown_key_id');
});

test('expired snapshot is not used for new catalog view', () => {
  const keys = makeKeys();
  const signed = signForumPricingBody(unsignedBody({
    effectiveAt: '2026-10-01T00:00:00.000Z',
    validUntil: '2026-10-02T00:00:00.000Z',
  }), keys.privateKeyPem, keys.keyId);
  const view = viewFromSnapshot(signed, { now: '2026-11-03T00:00:00.000Z' });
  assert.equal(view.expired, true);
});

test('V2 publish does not reprice a locked V1 quote economics', () => {
  const svc = (creditPrice) => ({
    code: 'seo-monthly-paid',
    label: 'Monthly',
    creditPrice,
    listPriceCredit: creditPrice,
    durationMonths: 1,
    renewalWindowDays: 7,
    enabled: true,
  });
  const locked = viewFromSnapshot(unsignedBody({ version: 1, seoServices: [svc(10)] })).products[0];
  const next = viewFromSnapshot(unsignedBody({
    version: 2,
    pricingVersionId: 'fpv_v2',
    seoServices: [svc(15)],
  })).products[0];
  assert.equal(locked.unitPriceCredit, 10);
  assert.equal(next.unitPriceCredit, 15);
  const quote = { unitPrice: locked.unitPriceCredit, quantity: 1, totalCredits: 10, priceVersion: 1 };
  assert.notEqual(next.unitPriceCredit, quote.unitPrice);
  assert.equal(quote.totalCredits, 10);
});

test('credit package mapping uses OPS-owned priceVnd/credits', () => {
  const view = viewFromSnapshot(unsignedBody());
  const pack = view.creditPackages.find((p) => p.code === 'pack_100');
  assert.equal(pack.amountVnd, 100000);
  assert.equal(pack.creditsGranted, 100);
  assert.equal(view.creditVnd, 1000);
  assert.equal(view.freeLaunch.creditsToGrant, 10);
});

test('paid_pin is OPS_CATALOG on PBN runtime bridge', () => {
  const view = viewFromSnapshot(unsignedBody());
  assert.equal(view.paidPinMigrationStatus, PAID_PIN_MIGRATION_STATUS);
  assert.equal(PAID_PIN_MIGRATION_STATUS, 'OPS_CATALOG');
  assert.equal(view.paidPins[0].pricingAuthority, 'ops-forum-pricing/1');
});

test('credit-order request fixture uses packageCode not local invention', () => {
  const order = loadJson('credit-order.request.json');
  assert.equal(order.packageCode, 'pack_100');
  assert.equal(order.pricingVersion, 1);
  assert.equal(Object.hasOwn(order, 'amountVnd'), false);
  const free = loadJson('free-launch-order.request.json');
  assert.equal(free.freeLaunch, true);
});

test('stripping signature is required before verify canonicalize', () => {
  const keys = makeKeys();
  const signed = signForumPricingBody(unsignedBody(), keys.privateKeyPem, keys.keyId);
  const body = snapshotWithoutSignature(signed);
  assert.equal(body.signature, undefined);
  assert.equal(signed.signature.alg, 'Ed25519');
});

test.after(() => {
  clearTrustedKeyRegistryCache();
  delete process.env.FORUM_PRICING_TRUSTED_KEYS_JSON;
});
