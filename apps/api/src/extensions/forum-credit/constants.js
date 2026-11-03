/** forum-credit/1 protocol constants — aligned with OPS-SERVER handoff. */

export const FORUM_CREDIT_CONTRACT = 'forum-credit/1';
export const FORUM_PRODUCT_CODE = 'pbn';
export const OPS_DEFAULT_BASE_URL = 'https://ops.seo-ops.duckdns.org';

export const HEADER_PRODUCT = 'x-ops-product-code';
export const HEADER_FORUM_ID = 'x-ops-forum-id';
export const HEADER_INSTALLATION_ID = 'x-ops-installation-id';
export const HEADER_API_CONTRACT = 'x-ops-api-contract';
export const HEADER_EVENT_ID = 'x-ops-event-id';

export const CREDIT_EVENT_TYPE = 'forum.credit.granted';

export const CONNECTION_STATUS = {
  DISCONNECTED: 'disconnected',
  VERIFYING: 'verifying',
  CONNECTED: 'connected',
  ERROR: 'error',
};

export const LEDGER_SYNC_STATUS = {
  PENDING: 'pending',
  SYNCING: 'syncing',
  SYNCED: 'synced',
  FAILED: 'failed',
};

export const ORDER_STATUS = {
  PENDING: 'pending',
  SUBMITTED: 'submitted',
  DELIVERED: 'delivered',
  FAILED: 'failed',
};

/** Ledger transaction type for OPS-delivered credit grants. */
export const TX_TYPE_OPS_CREDIT_GRANT = 'ops_credit_grant';
export const REF_TYPE_OPS_EVENT = 'ops_credit_event';
export const REF_TYPE_OPS_ORDER = 'ops_credit_order';
