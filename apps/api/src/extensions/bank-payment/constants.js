/**
 * Independent bank-transfer payment (Credit top-up).
 * Provider-agnostic constants — SePay is the first adapter, not hard-wired into Ledger.
 */

export const PROVIDER_SEPAY = 'sepay';
export const PROVIDER_FIXTURE = 'fixture';
export const PROVIDER_CASSO = 'casso';
export const PROVIDER_PAYOS = 'payos';

export const DEFAULT_PROVIDER = PROVIDER_SEPAY;

/** Feature flag keys (forum_commercial_settings + env). Default OFF. */
export const SETTING_BANK_PAYMENT_ENABLED = 'bank_payment_enabled';
export const SETTING_BANK_PAYMENT_PUBLIC = 'bank_payment_public';

export const ORDER_STATUS = {
  PENDING: 'pending',
  AWAITING_FUNDS: 'awaiting_funds',
  UNDERPAID: 'underpaid',
  OVERPAID: 'overpaid',
  PAID: 'paid',
  GRANTED: 'granted',
  UNMATCHED: 'unmatched',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
  FAILED: 'failed',
  PROVIDER_OFFLINE: 'provider_offline',
};

export const EVENT_STATUS = {
  RECEIVED: 'received',
  REJECTED: 'rejected',
  MATCHED: 'matched',
  DUPLICATE: 'duplicate',
  IGNORED: 'ignored',
  RECONCILED: 'reconciled',
};

export const MATCH_RESULT = {
  OK: 'ok',
  UNDERPAY: 'underpay',
  OVERPAY: 'overpay',
  WRONG_ACCOUNT: 'wrong_account',
  UNKNOWN_ORDER: 'unknown_order',
  WRONG_CODE: 'wrong_code',
  ALREADY_COMPLETE: 'already_complete',
  OUTBOUND: 'outbound',
  FORGED: 'forged',
  REPLAY: 'replay',
  PROVIDER_OFFLINE: 'provider_offline',
};

/** Ledger linkage — reuses existing sys_accounts / sys_transactions. */
export const TX_TYPE_BANK_TOPUP = 'bank_topup_grant';
export const REF_TYPE_BANK_ORDER = 'bank_payment_order';
export const REF_TYPE_BANK_EVENT = 'bank_payment_event';

/** Payment code: SePay template prefix (2–5 chars) + random suffix. */
export const PAYMENT_CODE_PREFIX = 'PBN';
export const PAYMENT_CODE_SUFFIX_LEN = 8;

export const WEBHOOK_REPLAY_WINDOW_SEC = 300;

/** Default top-up packages (VND). Credits derived at confirm-time from local vndPerCredit. */
export const DEFAULT_TOPUP_PACKAGES = [
  { code: 'topup_50k', amountVnd: 50_000, label: '50.000 VND', enabled: true, displayOrder: 10 },
  { code: 'topup_100k', amountVnd: 100_000, label: '100.000 VND', enabled: true, displayOrder: 20 },
  { code: 'topup_200k', amountVnd: 200_000, label: '200.000 VND', enabled: true, displayOrder: 30 },
  { code: 'topup_500k', amountVnd: 500_000, label: '500.000 VND', enabled: true, displayOrder: 40 },
];

export const SEPAY_QR_BASE = 'https://qr.sepay.vn/img';
export const SEPAY_API_BASE_V2 = 'https://userapi.sepay.vn/v2';
export const SEPAY_API_BASE_LEGACY = 'https://my.sepay.vn/userapi';
