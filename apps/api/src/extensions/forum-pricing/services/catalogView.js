import {
  PAID_PIN_MIGRATION_STATUS,
  DEFAULT_QUOTE_TTL_SECONDS,
  FORUM_PRICING_CONTRACT,
  SEO_SKU_ALIASES,
} from '../constants.js';

function canonicalSeoCode(code) {
  return SEO_SKU_ALIASES[code] || code;
}

/**
 * Map verified OPS snapshot into PBN-facing catalog views.
 * Duration/renewal for SEO must come from OPS fields — never invent local prices/durations.
 */
export function viewFromSnapshot(snapshot, meta = {}) {
  const now = meta.now ? new Date(meta.now).getTime() : Date.now();
  const validUntil = snapshot.validUntil ? Date.parse(snapshot.validUntil) : null;
  const expired = validUntil != null && validUntil <= now;
  const effective = Date.parse(snapshot.effectiveAt) <= now;

  const seoProducts = (snapshot.seoServices || [])
    .filter((s) => s.enabled)
    .map((s) => {
      if (!Number.isSafeInteger(s.durationMonths) || s.durationMonths < 1 || s.durationMonths > 12) {
        throw Object.assign(new Error('SEO durationMonths missing from OPS catalog'), {
          code: 'seo_duration_missing',
          statusCode: 409,
        });
      }
      if (!Number.isSafeInteger(s.renewalWindowDays) || s.renewalWindowDays < 0 || s.renewalWindowDays > 14) {
        throw Object.assign(new Error('SEO renewalWindowDays missing from OPS catalog'), {
          code: 'seo_renewal_missing',
          statusCode: 409,
        });
      }
      const productId = canonicalSeoCode(s.code);
      return {
        productId,
        opsCode: s.code,
        name: s.label || s.code,
        type: 'seo_entitlement',
        snapshotVersion: snapshot.version,
        priceVersion: snapshot.version,
        pricingVersionId: snapshot.pricingVersionId,
        sourceId: 'ops-forum-pricing',
        checksum: meta.checksum || null,
        durationMonths: s.durationMonths,
        listPriceCredit: Number.isSafeInteger(s.listPriceCredit) ? s.listPriceCredit : s.creditPrice,
        salePriceCredit: s.creditPrice,
        unitPriceCredit: s.creditPrice,
        effectiveAt: snapshot.effectiveAt,
        endsAt: snapshot.validUntil,
        snapshotValidUntil: snapshot.validUntil,
        renewalWindowDays: s.renewalWindowDays,
        discount: s.discount,
        opsSku: s,
      };
    });

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
      snapshotVersion: snapshot.version,
      pricingVersionId: snapshot.pricingVersionId,
      creditPrice: p.creditPrice,
      durationHours: p.durationHours,
      durationSeconds: p.durationHours * 3600,
      listPriceCredit: p.creditPrice,
      salePriceCredit: p.creditPrice,
      unitPriceCredit: p.creditPrice,
      price: p.creditPrice,
      enabled: true,
      pricingAuthority: 'ops-forum-pricing/1',
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
  const want = canonicalSeoCode(code);
  return (snapshot.seoServices || []).find((s) => {
    if (!s.enabled) return false;
    return s.code === code || canonicalSeoCode(s.code) === want;
  }) || null;
}

export function findPaidPin(snapshot, code) {
  return (snapshot.paidPins || []).find((p) => p.code === code && p.enabled) || null;
}
