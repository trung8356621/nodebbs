/**
 * Legacy development constant. Runtime monetary conversion MUST come from the
 * authenticated OPS pricing snapshot (`creditVnd`). Do not use this for charges.
 * Retained only for fixture/bootstrap scripts that build signed catalogs.
 */
export const CREDIT_VND = 10000;
export const BUSINESS_TIME_ZONE = 'Asia/Ho_Chi_Minh';
export const QUOTE_SECONDS = 300;

/** paid_pin catalog type exists; Forum-admin pin prices are not yet cut over. */
export const PAID_PIN_MIGRATION_STATUS = 'MIGRATION_PENDING';

export const QUOTE_STATUS = {
  OPEN: 'open',
  CONSUMED: 'consumed',
  CANCELED: 'canceled',
  REVOKED: 'revoked',
};

export const PRICING_PROVENANCE = {
  SNAPSHOT: 'snapshot',
  LEGACY_BACKFILL: 'legacy_backfill',
  UNKNOWN: 'unknown',
};
