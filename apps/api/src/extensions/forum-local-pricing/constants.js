export const SERVICE_PAID_PIN = 'paid_pin';
export const SERVICE_SEO = 'seo_entitlement';

export const KNOWN_SERVICES = [SERVICE_PAID_PIN, SERVICE_SEO];

export const SOURCE_FORUM_BASE = 'forum_base';
export const SOURCE_OPS_OVERRIDE = 'ops_override';
export const SOURCE_FREE_MODE = 'free_mode';
export const SOURCE_OPS_BAN = 'ops_ban';

/** Outbound Forum→OPS service sync is not supported by current OPS counterpart. */
export const OPS_SERVICE_SYNC_STATUS = {
  supported: false,
  labelKey: 'ledgerOpsSyncUnsupported',
  reason: 'No compatible OPS endpoint for Forum-base service sync. Requires a new contract (not forum-pricing/1 catalog pull).',
};
