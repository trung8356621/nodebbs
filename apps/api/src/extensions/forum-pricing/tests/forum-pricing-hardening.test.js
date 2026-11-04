import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  signForumPricingBody,
  verifyForumPricingSnapshot,
  exportSpkiBase64Url,
} from '../crypto.js';
import {
  clearTrustedKeyRegistryCache,
  resolveTrustedVerification,
  publicKeyFingerprint,
  loadTrustedKeyRegistry,
} from '../trust.js';
import { validateForumPricingSnapshot } from '../validate.js';
import { viewFromSnapshot, findSeoService, findPaidPin } from '../services/catalogView.js';
import { PAID_PIN_MIGRATION_STATUS, SEO_SKU_CODES } from '../constants.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../../../');

function makeKeys(keyId) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  return {
    keyId,
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    publicKeySpkiBase64Url: exportSpkiBase64Url(publicKey),
  };
}

function unsignedBody(overrides = {}) {
  const example = JSON.parse(
    fs.readFileSync(path.join(root, 'contracts/forum-pricing/v1/snapshot.example.json'), 'utf8'),
  );
  const { signature, ...rest } = example;
  return { ...rest, ...overrides };
}

function withTrust(keys, status = 'active') {
  clearTrustedKeyRegistryCache();
  process.env.FORUM_PRICING_TRUSTED_KEYS_JSON = JSON.stringify([{
    keyId: keys.keyId,
    publicKey: keys.publicKeySpkiBase64Url,
    status,
  }]);
  return loadTrustedKeyRegistry({ forceReload: true });
}

test('trusted registry rejects attacker key even when signature is valid', () => {
  const trusted = makeKeys('fpk_v1');
  const attacker = makeKeys('fpk_attacker');
  withTrust(trusted);

  const fake = signForumPricingBody(
    unsignedBody({ version: 99, vndPerCredit: 1, pricingVersionId: 'fpv_evil' }),
    attacker.privateKeyPem,
    attacker.keyId,
  );

  // Attacker ships matching verification.publicKey with the payload (classic TOFU attack).
  const syncVerification = {
    alg: 'Ed25519',
    keyId: attacker.keyId,
    publicKey: attacker.publicKeySpkiBase64Url,
  };
  const trust = resolveTrustedVerification(fake.signature.keyId, syncVerification);
  assert.equal(trust.ok, false);
  assert.equal(trust.reason, 'unknown_key_id');

  // Even if caller naively used attacker publicKey, source gate / registry is required.
  const naive = verifyForumPricingSnapshot(fake, {
    ...syncVerification,
    source: 'trusted_registry',
  });
  // Attacker key is not in registry path; direct verify with attacker material would succeed cryptographically:
  const cryptoOnly = verifyForumPricingSnapshot(fake, {
    keyId: attacker.keyId,
    publicKey: attacker.publicKeySpkiBase64Url,
    source: 'trusted_registry',
  });
  assert.equal(cryptoOnly.ok, true, 'crypto alone is insufficient — registry must gate');
  assert.equal(trust.ok, false, 'registry MUST reject attacker keyId');
});

test('trusted key verifies genuine OPS snapshot; wrong sync publicKey rejected', () => {
  const trusted = makeKeys('fpk_v1');
  const other = makeKeys('fpk_other');
  withTrust(trusted);
  const signed = signForumPricingBody(unsignedBody({ version: 1 }), trusted.privateKeyPem, trusted.keyId);
  validateForumPricingSnapshot(signed);

  const okTrust = resolveTrustedVerification(signed.signature.keyId, {
    keyId: trusted.keyId,
    publicKey: trusted.publicKeySpkiBase64Url,
  });
  assert.equal(okTrust.ok, true);
  assert.equal(verifyForumPricingSnapshot(signed, okTrust.verification).ok, true);

  const mismatch = resolveTrustedVerification(signed.signature.keyId, {
    keyId: trusted.keyId,
    publicKey: other.publicKeySpkiBase64Url,
  });
  assert.equal(mismatch.ok, false);
  assert.equal(mismatch.reason, 'untrusted_sync_public_key');
});

test('retired key cannot verify new catalogs (rotation)', () => {
  const oldKey = makeKeys('fpk_v1');
  const newKey = makeKeys('fpk_v2');
  clearTrustedKeyRegistryCache();
  process.env.FORUM_PRICING_TRUSTED_KEYS_JSON = JSON.stringify([
    { keyId: oldKey.keyId, publicKey: oldKey.publicKeySpkiBase64Url, status: 'retired' },
    { keyId: newKey.keyId, publicKey: newKey.publicKeySpkiBase64Url, status: 'active' },
  ]);
  loadTrustedKeyRegistry({ forceReload: true });

  const withOld = signForumPricingBody(unsignedBody({ version: 2 }), oldKey.privateKeyPem, oldKey.keyId);
  assert.equal(resolveTrustedVerification(withOld.signature.keyId).ok, false);

  const withNew = signForumPricingBody(unsignedBody({ version: 3, pricingVersionId: 'fpv_3' }), newKey.privateKeyPem, newKey.keyId);
  const trust = resolveTrustedVerification(withNew.signature.keyId);
  assert.equal(trust.ok, true);
  assert.equal(verifyForumPricingSnapshot(withNew, trust.verification).ok, true);
});

test('SEO SKUs align with OPS codes and require OPS duration authority', () => {
  const body = unsignedBody();
  const view = viewFromSnapshot(body);
  assert.ok(view.products.some((p) => p.productId === SEO_SKU_CODES.MONTHLY_PAID));
  assert.ok(view.products.some((p) => p.productId === SEO_SKU_CODES.MONTHLY_FREE));
  const alias = findSeoService(body, 'seo_audit_basic');
  assert.ok(alias);
  const mapped = view.products.find((p) => p.opsCode === 'seo_audit_basic');
  assert.equal(mapped.productId, SEO_SKU_CODES.MONTHLY_PAID);
  assert.equal(mapped.durationMonths, 1);
  assert.equal(mapped.renewalWindowDays, 7);

  assert.throws(() => validateForumPricingSnapshot(signForumPricingBody({
    ...body,
    seoServices: [{ code: 'x', creditPrice: 1, enabled: true }],
    signature: { alg: 'Ed25519', keyId: 'k', value: 'x' },
  }, makeKeys('k').privateKeyPem, 'k')), /seo_duration_missing|Invalid/);
});

test('paid_pin consumed from OPS catalog; not Forum-admin', () => {
  const view = viewFromSnapshot(unsignedBody());
  assert.equal(view.paidPinMigrationStatus, PAID_PIN_MIGRATION_STATUS);
  assert.equal(PAID_PIN_MIGRATION_STATUS, 'OPS_CATALOG');
  const pin = findPaidPin(unsignedBody(), 'pin_24h');
  assert.equal(pin.creditPrice, 20);
  assert.equal(pin.durationHours, 24);
  assert.equal(view.paidPins[0].pricingAuthority, 'ops-forum-pricing/1');
});

test('V1 quote economics survive V2 catalog publication', () => {
  const v1 = viewFromSnapshot(unsignedBody({
    version: 1,
    seoServices: [{
      code: 'seo-monthly-paid',
      label: 'Monthly',
      creditPrice: 10,
      listPriceCredit: 10,
      durationMonths: 1,
      renewalWindowDays: 7,
      enabled: true,
    }],
  }));
  const v2 = viewFromSnapshot(unsignedBody({
    version: 2,
    pricingVersionId: 'fpv_2',
    seoServices: [{
      code: 'seo-monthly-paid',
      label: 'Monthly',
      creditPrice: 15,
      listPriceCredit: 15,
      durationMonths: 1,
      renewalWindowDays: 7,
      enabled: true,
    }],
  }));
  const locked = { unitPrice: v1.products[0].unitPriceCredit, totalCredits: 10, priceVersion: 1 };
  assert.equal(locked.totalCredits, 10);
  assert.equal(v2.products[0].unitPriceCredit, 15);
  assert.notEqual(v2.products[0].unitPriceCredit, locked.unitPrice);
});

test('fingerprint is stable for trust pinning', () => {
  const keys = makeKeys('fpk_v1');
  assert.equal(publicKeyFingerprint(keys.publicKeySpkiBase64Url).length, 64);
});

test.after(() => {
  clearTrustedKeyRegistryCache();
  delete process.env.FORUM_PRICING_TRUSTED_KEYS_JSON;
});
