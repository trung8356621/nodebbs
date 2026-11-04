/** forum-pricing/1 — aligned with OPS-SERVER commit 0683c6e (+ PBN hardening). */

export const FORUM_PRICING_CONTRACT = 'forum-pricing/1';
export const FORUM_PRICING_PRODUCT_KEY = 'pbn';
export const FORUM_PRICING_ALG = 'Ed25519';

export const HEADER_API_CONTRACT = 'x-ops-api-contract';

/** paid_pin prices consumed from OPS catalog; Forum-admin monetary edits disabled. */
export const PAID_PIN_MIGRATION_STATUS = 'OPS_CATALOG';

/**
 * Canonical SEO SKU codes expected from OPS (align with historical PBN IDs where possible).
 * OPS example `seo_audit_basic` is accepted as an alias of monthly paid SEO until OPS republishes.
 */
export const SEO_SKU_CODES = Object.freeze({
  MONTHLY_FREE: 'seo-monthly',
  MONTHLY_PAID: 'seo-monthly-paid',
  AUDIT_BASIC_ALIAS: 'seo_audit_basic',
});

export const SEO_SKU_ALIASES = Object.freeze({
  [SEO_SKU_CODES.AUDIT_BASIC_ALIAS]: SEO_SKU_CODES.MONTHLY_PAID,
});

export const DEFAULT_QUOTE_TTL_SECONDS = 900;
