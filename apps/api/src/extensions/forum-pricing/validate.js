import { FORUM_PRICING_CONTRACT, FORUM_PRICING_PRODUCT_KEY } from './constants.js';

const integer = (n, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) =>
  Number.isSafeInteger(n) && n >= min && n <= max;

function requireIso(v, allowNull = false) {
  if (v == null) return allowNull;
  if (typeof v !== 'string' || !Number.isFinite(Date.parse(v))) return false;
  return true;
}

/** Structural validation of OPS forum-pricing/1 snapshot (unsigned or signed). */
export function validateForumPricingSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    throw Object.assign(new Error('Invalid forum-pricing snapshot'), { code: 'invalid_snapshot' });
  }
  if (snapshot.schemaVersion !== FORUM_PRICING_CONTRACT) {
    throw Object.assign(new Error('contract_mismatch'), { code: 'contract_mismatch' });
  }
  if (snapshot.productKey !== FORUM_PRICING_PRODUCT_KEY) {
    throw Object.assign(new Error('product_key_mismatch'), { code: 'product_key_mismatch' });
  }
  if (!integer(snapshot.version, 1)) {
    throw Object.assign(new Error('invalid_version'), { code: 'invalid_version' });
  }
  if (typeof snapshot.pricingVersionId !== 'string' || !snapshot.pricingVersionId.trim()) {
    throw Object.assign(new Error('invalid_pricing_version_id'), { code: 'invalid_pricing_version_id' });
  }
  if (!requireIso(snapshot.issuedAt) || !requireIso(snapshot.effectiveAt) || !requireIso(snapshot.validUntil, true)) {
    throw Object.assign(new Error('invalid_timestamps'), { code: 'invalid_timestamps' });
  }
  if (snapshot.currency !== 'VND' || !integer(snapshot.vndPerCredit, 1)) {
    throw Object.assign(new Error('invalid_conversion'), { code: 'invalid_conversion' });
  }
  if (!Array.isArray(snapshot.creditPackages) || !Array.isArray(snapshot.seoServices) || !Array.isArray(snapshot.paidPins)) {
    throw Object.assign(new Error('invalid_catalog_arrays'), { code: 'invalid_catalog_arrays' });
  }
  for (const p of snapshot.creditPackages) {
    if (!p?.code || !integer(p.credits, 1) || !integer(p.priceVnd, 0) || typeof p.enabled !== 'boolean') {
      throw Object.assign(new Error('invalid_credit_package'), { code: 'invalid_credit_package' });
    }
  }
  for (const s of snapshot.seoServices) {
    if (!s?.code || !integer(s.creditPrice, 0) || typeof s.enabled !== 'boolean') {
      throw Object.assign(new Error('invalid_seo_service'), { code: 'invalid_seo_service' });
    }
    // Duration authority belongs to OPS — required for PBN SEO entitlement consumption.
    if (!integer(s.durationMonths, 1, 12)) {
      throw Object.assign(new Error('seo_duration_missing'), { code: 'seo_duration_missing' });
    }
    if (!integer(s.renewalWindowDays, 0, 14)) {
      throw Object.assign(new Error('seo_renewal_missing'), { code: 'seo_renewal_missing' });
    }
  }
  for (const pin of snapshot.paidPins) {
    if (!pin?.code || !integer(pin.creditPrice, 0) || !integer(pin.durationHours, 1) || typeof pin.enabled !== 'boolean') {
      throw Object.assign(new Error('invalid_paid_pin'), { code: 'invalid_paid_pin' });
    }
  }
  const fl = snapshot.freeLaunch;
  if (!fl || typeof fl.enabled !== 'boolean' || !integer(fl.creditsToGrant, 0) || !integer(fl.maxPerLocalUser, 0)) {
    throw Object.assign(new Error('invalid_free_launch'), { code: 'invalid_free_launch' });
  }
  if (!snapshot.signature || snapshot.signature.alg !== 'Ed25519'
    || typeof snapshot.signature.keyId !== 'string' || typeof snapshot.signature.value !== 'string') {
    throw Object.assign(new Error('invalid_signature_block'), { code: 'invalid_signature_block' });
  }
  return snapshot;
}
