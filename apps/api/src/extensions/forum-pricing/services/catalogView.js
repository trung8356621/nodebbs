import {
  PAID_PIN_MIGRATION_STATUS,
  SEO_DEFAULT_DURATION_MONTHS,
  SEO_DEFAULT_RENEWAL_WINDOW_DAYS,
  DEFAULT_QUOTE_TTL_SECONDS,
  FORUM_PRICING_CONTRACT,
} from '../constants.js';

/**
 * Map verified OPS snapshot into PBN-facing catalog views.
 * Does not invent monetary values — only maps OPS fields + documented entitlement defaults.
 */
export function viewFromSnapshot(snapshot, meta = {}) {
  const now = meta.now ? new Date(meta.now).getTime() : Date.now();
  const validUntil = snapshot.validUntil ? Date.parse(snapshot.validUntil) : null;
  const expired = validUntil != null && validUntil <= now;
  const effective = Date.parse(snapshot.effectiveAt) <= now;

  const seoProducts = (snapshot.seoServices || [])
    .filter((s) => s.enabled)
    .map((s) => ({
      productId: s.code,
      name: s.label || s.code,
      type: 'seo_entitlement',
      snapshotVersion: snapshot.version,
      priceVersion: snapshot.version,
      pricingVersionId: snapshot.pricingVersionId,
      sourceId: 'ops-forum-pricing',
      checksum: meta.checksum || null,
      durationMonths: SEO_DEFAULT_DURATION_MONTHS,
      listPriceCredit: s.creditPrice,
      salePriceCredit: s.creditPrice,
      unitPriceCredit: s.creditPrice,
      effectiveAt: snapshot.effectiveAt,
      endsAt: snapshot.validUntil,
      snapshotValidUntil: snapshot.validUntil,
      renewalWindowDays: SEO_DEFAULT_RENEWAL_WINDOW_DAYS,
      discount: undefined,
      opsSku: s,
    }));

  const creditPackages = (snapshot.creditPackages || [])
    .filter((p) => p.enabled)
    .map((p) => ({
      id: p.code,
      code: p.code,
      name: p.label || p.code,
      type: 'credit_package',
      priceVersion: snapshot.version,
      creditsGranted: p.credits,
      amountVnd: p.priceVnd,
      listAmountVnd: p.priceVnd,
      saleAmountVnd: p.priceVnd,
      enabled: true,
      effectiveAt: snapshot.effectiveAt,
      endsAt: snapshot.validUntil,
    }));

  const paidPins = (snapshot.paidPins || [])
    .filter((p) => p.enabled)
    .map((p) => ({
      id: p.code,
      code: p.code,
      name: p.label || p.code,
      type: 'paid_pin',
      priceVersion: snapshot.version,
      creditPrice: p.creditPrice,
      durationHours: p.durationHours,
      durationSeconds: p.durationHours * 3600,
      listPriceCredit: p.creditPrice,
      salePriceCredit: p.creditPrice,
      unitPriceCredit: p.creditPrice,
      enabled: true,
      pricingMigrationStatus: PAID_PIN_MIGRATION_STATUS,
    }));

  return {
    contract: FORUM_PRICING_CONTRACT,
    schemaVersion: snapshot.schemaVersion,
    snapshotVersion: snapshot.version,
    pricingVersionId: snapshot.pricingVersionId,
    creditVnd: snapshot.vndPerCredit,
    vndPerCredit: snapshot.vndPerCredit,
    businessTimeZone: 'Asia/Ho_Chi_Minh',
    quoteTtlSeconds: DEFAULT_QUOTE_TTL_SECONDS,
    issuedAt: snapshot.issuedAt,
    effectiveAt: snapshot.effectiveAt,
    validUntil: snapshot.validUntil,
    effective,
    expired,
    freeLaunch: snapshot.freeLaunch,
    products: seoProducts,
    creditPackages,
    paidPins,
    paidPinMigrationStatus: PAID_PIN_MIGRATION_STATUS,
    authority: 'ops-forum-pricing/1',
  };
}

export function findPackage(snapshot, packageCode) {
  return (snapshot.creditPackages || []).find((p) => p.code === packageCode && p.enabled) || null;
}

export function findSeoService(snapshot, code) {
  return (snapshot.seoServices || []).find((s) => s.code === code && s.enabled) || null;
}
